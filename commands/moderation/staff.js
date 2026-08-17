const { ChannelType, EmbedBuilder } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');
const { freezeKey, queueBanKey, releaseFreeze } = require('../../src/bot/functions/enforcement');
const { profileKey } = require('../../src/bot/functions/registration');
const queue = require('../queue/queue');

const roles = (config, names) => names.flatMap(name => config.role?.[name] || []).filter(Boolean);
const hasRole = (member, ids) => ids.length > 0 && member.roles.cache.some(role => ids.includes(role.id));
const staffOnly = (client, member, userId) => client.config.owners.includes(userId) || client.config.developers.includes(userId) || hasRole(member, roles(client.config, ['staff']));
const screenSharerOnly = (client, member, userId) => staffOnly(client, member, userId) || hasRole(member, roles(client.config, ['screenSharer', 'seniorScreenSharer']));
const replyError = (message, description) => sendError('message', message, 'Permesso negato', description, 'Red');
const log = (client, content) => client.channels.cache.get(client.config.channelLogsId)?.send({ content }).catch(() => null);
const resolveMember = (message, input) => message.mentions.members.first() || message.guild.members.cache.get(input) || message.guild.members.cache.find(m => m.user.username.toLowerCase() === input?.toLowerCase() || m.displayName.toLowerCase() === input?.toLowerCase());

function duration(input) {
  const match = /^(\d+)(m|h|d)$/i.exec(input || '');
  if (!match) return null;
  const factor = { m: 60e3, h: 3600e3, d: 86400e3 }[match[2].toLowerCase()];
  const value = Number(match[1]) * factor;
  return value > 0 && value <= 28 * 86400e3 ? value : null;
}

async function createTournament(client, message, args) {
  const count = Number(args.shift());
  const label = args.join(' ').trim() || 'torneo';
  if (!Number.isInteger(count) || count < 2 || count > 99) return replyError(message, 'Inserisci un numero di giocatori tra 2 e 99. Esempio: `=tournament create 16 summer cup`.');
  if (!/^[\p{L}\p{N} _-]{1,40}$/u.test(label)) return replyError(message, 'Nome torneo non valido.');
  const minutes = client.config.temporaryTournamentMinutes ?? 240;
  const channel = await message.guild.channels.create({
    name: `torneo-${label.toLowerCase().replace(/\s+/g, '-')}`,
    type: ChannelType.GuildVoice,
    userLimit: count,
    parent: client.config.tournamentCategoryId || undefined,
    reason: `Stanza torneo creata da ${message.author.tag}`,
  });
  const record = { channelId: channel.id, label, playerLimit: count, createdBy: message.author.id, expiresAt: Date.now() + minutes * 60e3 };
  await client.db.set(`tournament_${channel.id}`, record);
  const remove = async () => {
    const current = await client.db.get(`tournament_${channel.id}`);
    if (current?.expiresAt <= Date.now()) {
      await channel.delete('Stanza torneo scaduta').catch(() => null);
      await client.db.delete(`tournament_${channel.id}`);
    }
  };
  setTimeout(remove, minutes * 60e3).unref?.();
  await message.reply(`✅ Stanza temporanea creata: ${channel} — massimo ${count} giocatori, eliminazione tra ${minutes} minuti.`);
  await log(client, `🏁 ${message.author} ha creato ${channel} per **${label}** (${count} giocatori).`);
}

module.exports = {
  name: 'staff',
  aliases: ['report', 'freeze', 'unfreeze', 'strike', 'unstrike', 'strikes', 'ban', 'unban', 'tournament'],
  description: 'Moderazione, segnalazioni e stanze torneo.',
  usage: '=report @utente motivo',
  run: async (client, message, args, invokedAs) => {
    const action = invokedAs === 'staff' ? args.shift()?.toLowerCase() : invokedAs;
    if (action === 'report') {
      const target = resolveMember(message, args.shift());
      const reason = args.join(' ').trim();
      if (!target || target.user.bot || target.id === message.author.id || !reason) return replyError(message, 'Uso: `=report @utente <motivo>`.');
      const access = await client.db.get('access_config'); const destination = client.channels.cache.get(access?.ssRequestChannelId || client.config.channelSsRequestsId || client.config.channelReportsId || client.config.channelLogsId);
      if (!destination) return replyError(message, 'Canale report non configurato.');
      await destination.send({ embeds: [new EmbedBuilder().setColor('Orange').setTitle('Nuovo report')
        .addFields({ name: 'Segnalato da', value: `${message.author} (${message.author.id})` }, { name: 'Utente segnalato', value: `${target} (${target.id})` }, { name: 'Motivo', value: reason.slice(0, 1024) })
        .setTimestamp()] });
      return message.reply('✅ Report inviato allo staff.');
    }
    if (action === 'freeze' || action === 'unfreeze') {
      if (!screenSharerOnly(client, message.member, message.author.id)) return replyError(message, 'Questo comando è riservato a ScreenSharer, Sr. ScreenSharer e staff.');
      const target = resolveMember(message, args.shift());
      if (!target || target.user.bot || target.id === message.author.id || !await client.db.get(profileKey(target.id))) return replyError(message, `Uso: \`=${action} @utente ${action === 'freeze' ? '[durata 10m/2h/1d] <motivo>' : ''}\`. L’utente deve essere registrato.`);
      const access = await client.db.get('access_config'); const frozenVoice = access?.frozenVoiceChannelId && message.guild.channels.cache.get(access.frozenVoiceChannelId);
      if (!frozenVoice) return replyError(message, 'Vocale Frozen non configurata. Lo staff deve usare prima `=access setup`.');
      if (action === 'unfreeze') { await releaseFreeze(client, message.guild, target.id); await log(client, `🔓 ${message.author} ha sbloccato ${target}.`); return message.reply(`${target} è stato sbloccato e può rientrare in coda.`); }
      const supplied = duration(args[0]); const ms = supplied || (client.config.freezeDurationMinutes ?? 10) * 60e3; if (args[0] && !supplied) return replyError(message, 'Durata non valida: usa `10m`, `2h` o `1d`.');
      if (supplied) args.shift(); const reason = args.join(' ').trim() || 'Controllo ScreenShare'; const expiresAt = Date.now() + ms;
      await client.db.set(freezeKey(target.id), { userId: target.id, guildId: message.guild.id, frozenVoiceChannelId: frozenVoice.id, expiresAt, reason, by: message.author.id }); await queue.leavePlayerQueue(client, target.id);
      await frozenVoice.permissionOverwrites.edit(target.id, { ViewChannel: true, Connect: true, Speak: true }, 'Utente freezato'); await target.voice.setChannel(frozenVoice).catch(() => null);
      setTimeout(() => releaseFreeze(client, message.guild, target.id).catch(() => null), ms).unref?.();
      await log(client, `❄️ ${message.author} ha freezato ${target} fino al <t:${Math.floor(expiresAt / 1000)}:R>. Motivo: ${reason}`); return message.reply(`${target} è freezato fino al <t:${Math.floor(expiresAt / 1000)}:R> e può accedere solo a ${frozenVoice}.`);
    }
    if (!staffOnly(client, message.member, message.author.id)) return replyError(message, 'Questo comando è riservato allo staff. Configura `role.staff` con l’ID del ruolo staff.');
    if (action === 'strike' || action === 'unstrike' || action === 'strikes') {
      const target = resolveMember(message, args.shift());
      if (!target || target.user.bot) return replyError(message, `Uso: \`=${action} @utente${action === 'strike' ? ' <motivo>' : ''}\`.`);
      const dbKey = `discipline_${target.id}`; const record = await client.db.get(dbKey) || { strikes: 0, history: [] };
      if (action === 'strikes') return message.reply(`${target} ha **${record.strikes}** strike.`);
      if (action === 'strike') { const reason = args.join(' ').trim(); if (!reason) return replyError(message, 'Indica il motivo dello strike.'); record.strikes += 1; record.history.push({ by: message.author.id, reason: reason.slice(0, 500), at: Date.now() }); }
      else if (!record.strikes) return replyError(message, 'L’utente non ha strike da rimuovere.');
      else { record.strikes -= 1; record.history.push({ by: message.author.id, reason: 'Strike rimosso', at: Date.now() }); }
      await client.db.set(dbKey, record); await log(client, `⚠️ ${message.author} ha ${action === 'strike' ? 'aggiunto' : 'rimosso'} uno strike a ${target}. Totale: ${record.strikes}.`);
      return message.reply(`${target} ora ha **${record.strikes}** strike.`);
    }
    if (action === 'ban' || action === 'unban') {
      const target = resolveMember(message, args.shift()); if (!target || target.user.bot || !await client.db.get(profileKey(target.id))) return replyError(message, `Uso: \`=${action} @utente${action === 'ban' ? ' <giorni> <motivo>' : ''}\`. L’utente deve essere registrato.`);
      if (action === 'unban') { await client.db.delete(queueBanKey(target.id)); return message.reply(`${target} può di nuovo entrare in coda.`); }
      const days = Number(args.shift()); const reason = args.join(' ').trim() || 'Nessun motivo indicato'; if (!Number.isInteger(days) || days < 1 || days > 365) return replyError(message, 'Indica una durata da 1 a 365 giorni: `=ban @utente 7 <motivo>`.');
      const expiresAt = Date.now() + days * 86400e3; await client.db.set(queueBanKey(target.id), { userId: target.id, expiresAt, reason, by: message.author.id }); await queue.leavePlayerQueue(client, target.id); await log(client, `⛔ ${message.author} ha bannato ${target} dalla coda per ${days} giorni. Motivo: ${reason}`);
      return message.reply(`${target} è bannato solo dalla coda fino al <t:${Math.floor(expiresAt / 1000)}:R>; può continuare a vedere il server e usare le chat consentite.`);
    }
    if (action === 'tournament') {
      const subcommand = args.shift()?.toLowerCase();
      if (subcommand === 'create') return createTournament(client, message, args);
      if (subcommand === 'delete') { const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[0]); if (!channel || !(await client.db.get(`tournament_${channel.id}`))) return replyError(message, 'Indica una stanza torneo creata dal bot.'); await channel.delete(`Eliminata da ${message.author.tag}`); await client.db.delete(`tournament_${channel.id}`); return message.reply('Stanza torneo eliminata.'); }
      return replyError(message, 'Uso: `=tournament create <2-99> <nome>` oppure `=tournament delete #stanza`.');
    }
    return replyError(message, 'Comando sconosciuto.');
  },
};

const targetOption = { name: 'utente', description: 'Utente interessato', type: 6, required: false };
function moderationSlash(name, fixedAction = null) {
  const options = fixedAction
    ? [targetOption, { name: 'durata', description: 'Freeze: es. 10m, 2h o 1d', type: 3, required: false }, { name: 'testo', description: 'Motivo, nome torneo o altra informazione', type: 3, required: false }, { name: 'giocatori', description: 'Torneo: limite giocatori', type: 4, required: false }, { name: 'canale', description: 'Torneo: stanza da eliminare', type: 7, required: false }, { name: 'azione_torneo', description: 'Torneo: create o delete', type: 3, required: false, choices: [{ name: 'create', value: 'create' }, { name: 'delete', value: 'delete' }] }]
    : [{ name: 'azione', description: 'Comando staff', type: 3, required: true, choices: ['report', 'freeze', 'unfreeze', 'strike', 'unstrike', 'strikes', 'ban', 'unban', 'tournament'].map(value => ({ name: value, value })) }, targetOption, { name: 'durata', description: 'Freeze: 10m; Ban: giorni', type: 3, required: false }, { name: 'testo', description: 'Motivo o nome torneo', type: 3, required: false }, { name: 'giocatori', description: 'Torneo: limite giocatori', type: 4, required: false }, { name: 'canale', description: 'Torneo: stanza', type: 7, required: false }, { name: 'azione_torneo', description: 'Torneo: create o delete', type: 3, required: false }];
  return {
    name, description: fixedAction ? `Comando staff: ${fixedAction}.` : 'Comandi di moderazione staff.', options,
    run: async (client, interaction) => {
      const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const action = fixedAction || interaction.options.getString('azione'); const target = interaction.options.getMember('utente'); const text = interaction.options.getString('testo'); const duration = interaction.options.getString('durata'); const players = interaction.options.getInteger('giocatori'); const channel = interaction.options.getChannel('canale');
      const args = [];
      if (action === 'tournament') { args.push(interaction.options.getString('azione_torneo') || 'create'); if (players !== null) args.push(String(players)); if (channel) args.push(channel.id); if (text) args.push(...text.split(/\s+/)); }
      else { if (target) args.push(target.id); if (duration) args.push(duration); if (text) args.push(...text.split(/\s+/)); }
      return module.exports.run(client, interactionMessage(interaction, target), args, action);
    },
  };
}
module.exports.slash = moderationSlash('staff');
module.exports.slashes = [module.exports.slash, ...['report', 'freeze', 'unfreeze', 'strike', 'unstrike', 'strikes', 'ban', 'unban', 'tournament'].map(name => moderationSlash(name, name))];

module.exports.cleanupTemporaryTournaments = async client => {
  const records = (await client.db.all()).filter(entry => entry.id.startsWith('tournament_') && entry.value?.expiresAt <= Date.now());
  await Promise.all(records.map(async entry => { await client.channels.fetch(entry.value.channelId).then(channel => channel.delete('Stanza torneo scaduta')).catch(() => null); await client.db.delete(entry.id); }));
};
