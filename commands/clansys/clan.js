const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');

const key = name => `clan_${name.toLowerCase().trim().replace(/\s+/g, '_')}`;
const clanEntries = async db => (await db.all()).filter(x => x.id.startsWith('clan_') && x.value?.members);
const clanOf = async (db, userId) => (await clanEntries(db)).find(x => x.value.members.includes(userId));
const isOfficer = (clan, userId) => clan && (clan.value.leader === userId || clan.value.coleader.includes(userId) || clan.value.mod.includes(userId));
const isLeader = (clan, userId) => clan?.value.leader === userId;
const log = (client, text) => client.channels.cache.get(client.config.channelLogsId)?.send({ content: text }).catch(() => null);
const error = (message, text) => sendError('message', message, 'Clan', text, 'Red');
const member = (message, input) => message.mentions.members.first() || message.guild.members.cache.get(input) || message.guild.members.cache.find(m => m.user.username.toLowerCase() === input?.toLowerCase() || m.displayName.toLowerCase() === input?.toLowerCase());

function clanEmbed(clan) {
  const c = clan.value;
  const regular = c.members.filter(id => id !== c.leader && !c.coleader.includes(id) && !c.mod.includes(id));
  return new EmbedBuilder().setColor('FFFFFF').setTitle(`Clan: ${c.nameoftheclan}`)
    .addFields(
      { name: 'ELO', value: String(c.elo ?? 1000), inline: true },
      { name: 'Stato', value: c.status || 'Created', inline: true },
      { name: 'Leader', value: `<@${c.leader}>`, inline: true },
      { name: 'Co-leader', value: c.coleader.map(id => `<@${id}>`).join(' ') || '—', inline: true },
      { name: 'Mod', value: c.mod.map(id => `<@${id}>`).join(' ') || '—', inline: true },
      { name: `Membri (${c.members.length})`, value: regular.map(id => `<@${id}>`).join(' ') || '—' });
}

async function queue(client, message, clan, mode) {
  const season = await client.db.get('system_season') || client.config.season;
  if (!season?.active) return error(message, 'Le code sono chiuse: la stagione non è attiva.');
  const readyKey = `clan_ready_${clan.id}`;
  const queueKey = `clan_queue_${clan.id}`;
  const ready = await client.db.get(readyKey) || { members: [] };
  if (mode === 'ready' || mode === 'unready') {
    const members = new Set(ready.members);
    if (mode === 'ready') members.add(message.author.id); else members.delete(message.author.id);
    await client.db.set(readyKey, { members: [...members] });
    const missing = clan.value.members.filter(id => !members.has(id));
    return message.reply(missing.length ? `Pronto registrato. Mancano ${missing.map(id => `<@${id}>`).join(', ')}.` : '✅ Tutti i membri del clan sono pronti. Un leader/co-leader può usare `clan q join`.');
  }
  if (mode === 'leave') {
    await client.db.delete(queueKey);
    return message.reply('Il tuo clan è stato rimosso dalla coda.');
  }
  if (mode === 'status') {
    const missing = clan.value.members.filter(id => !ready.members.includes(id));
    return message.reply(missing.length ? `Pronti: ${ready.members.length}/${clan.value.members.length}. Mancano: ${missing.map(id => `<@${id}>`).join(', ')}` : 'Tutti i membri sono pronti.');
  }
  if (mode !== 'join') return error(message, 'Usa `clan q ready`, `clan q join`, `clan q leave` o `clan q status`.');
  const missing = clan.value.members.filter(id => !ready.members.includes(id));
  if (missing.length) return error(message, `Tutti i membri devono essere pronti. Mancano: ${missing.map(id => `<@${id}>`).join(', ')}.`);
  const existing = await client.db.get(queueKey);
  if (existing) return message.reply('Il tuo clan è già in coda. Usa `clan q leave` per annullare.');
  const queues = (await client.db.all()).filter(x => x.id.startsWith('clan_queue_') && x.value?.clanId !== clan.id);
  const candidates = await Promise.all(queues.map(async entry => ({ entry, clan: await client.db.get(entry.value.clanId) })));
  const range = client.config.queueEloRange ?? 200;
  const match = candidates.filter(x => x.clan?.status === 'Created' && Math.abs((x.clan.elo ?? 1000) - (clan.value.elo ?? 1000)) <= range)
    .sort((a, b) => Math.abs(a.clan.elo - clan.value.elo) - Math.abs(b.clan.elo - clan.value.elo))[0];
  if (!match) {
    await client.db.set(queueKey, { clanId: clan.id, queuedAt: Date.now() });
    return message.reply(`✅ **${clan.value.nameoftheclan}** è in coda (${clan.value.elo} ELO). Range iniziale: ±${range}.`);
  }
  const matchId = `match_${Date.now()}`;
  await client.db.set(matchId, { type: 'clan', clans: [clan.id, match.entry.value.clanId], status: 'pending', createdAt: Date.now() });
  await client.db.delete(match.entry.id);
  await client.db.delete(queueKey);
  await client.db.delete(readyKey);
  await client.db.delete(`clan_ready_${match.entry.value.clanId}`);
  return message.channel.send({ embeds: [new EmbedBuilder().setColor('Gold').setTitle('⚔️ Clan War trovata')
    .setDescription(`**${clan.value.nameoftheclan}** (${clan.value.elo} ELO) vs **${match.clan.nameoftheclan}** (${match.clan.elo} ELO)\nID match: \`${matchId}\``)
    .setFooter({ text: 'Lo staff conclude con: clan result <ID match> <nome clan vincitore>' })] });
}

module.exports = {
  name: 'clan', aliases: ['c'],
  run: async (client, message, args) => {
    const action = args.shift()?.toLowerCase();
    const mine = await clanOf(client.db, message.author.id);
    if (!action || action === 'help') return message.reply(`Comandi: create, delete, invite, kick, leave, promote, demote, info, rename, q, result. Esempio: \`${client.prefix}clan q\`.`);

    if (action === 'create') {
      const name = args.join(' ').trim();
      if (!name || name.length > 15 || !/^[\p{L}\p{N} ]+$/u.test(name)) return error(message, 'Nome non valido: usa lettere/numeri/spazi, massimo 15 caratteri.');
      if (mine) return error(message, 'Sei già in un clan.');
      const id = key(name);
      if (await client.db.get(id)) return error(message, 'Questo nome è già usato.');
      await client.db.set(id, { leader: message.author.id, nameoftheclan: name, mod: [], coleader: [], members: [message.author.id], status: 'Creating', elo: client.config.eloStart });
      const requests = client.channels.cache.get(client.config.channelRequestsId);
      if (!requests) return error(message, 'Canale richieste non configurato; contatta lo staff.');
      await requests.send({ content: `<@&${client.config.channelRequestsRoleId}>`, embeds: [new EmbedBuilder().setColor('Yellow').setTitle('Richiesta clan').addFields({ name: 'Leader', value: `<@${message.author.id}>`, inline: true }, { name: 'Nome clan', value: name, inline: true })], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`clan-accept:${id}`).setLabel('Accetta').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`clan-deny:${id}`).setLabel('Rifiuta').setStyle(ButtonStyle.Danger))] });
      return message.reply('Richiesta inviata allo staff.');
    }
    if (action === 'info') {
      const name = args.join(' ');
      const target = name ? await client.db.get(key(name)) : mine?.value;
      const entry = name ? { id: key(name), value: target } : mine;
      return entry?.value ? message.channel.send({ embeds: [clanEmbed(entry)] }) : error(message, 'Clan non trovato.');
    }
    if (!mine) return error(message, 'Non fai parte di un clan.');
    if (action === 'q' || action === 'queue') {
      const mode = args[0]?.toLowerCase();
      if (mode !== 'ready' && mode !== 'unready' && !isLeader(mine, message.author.id) && !mine.value.coleader.includes(message.author.id)) return error(message, 'Solo leader e co-leader possono iscrivere o ritirare il clan dalla coda.');
      if (mine.value.status !== 'Created') return error(message, 'Il clan deve essere approvato prima di entrare in coda.');
      return queue(client, message, mine, mode);
    }
    if (action === 'leave') {
      if (isLeader(mine, message.author.id)) return error(message, 'Il leader deve trasferire o eliminare il clan.');
      await client.db.pull(`${mine.id}.members`, message.author.id); await client.db.pull(`${mine.id}.mod`, message.author.id); await client.db.pull(`${mine.id}.coleader`, message.author.id);
      return message.reply('Hai lasciato il clan.');
    }
    if (action === 'delete') {
      if (!isLeader(mine, message.author.id)) return error(message, 'Solo il leader può eliminare il clan.');
      await client.db.delete(`clan_queue_${mine.id}`); await client.db.delete(`clan_ready_${mine.id}`); await client.db.delete(mine.id);
      return message.reply('Clan eliminato.');
    }
    if (action === 'invite') {
      const target = member(message, args[0]);
      if (!target || target.user.bot) return error(message, 'Menziona un utente valido.');
      if (!isOfficer(mine, message.author.id)) return error(message, 'Solo gli officer possono invitare.');
      if (mine.value.status !== 'Created' || mine.value.members.length >= (client.config.maxClanMembers ?? 10)) return error(message, 'Clan non disponibile per inviti.');
      if (await clanOf(client.db, target.id)) return error(message, 'L’utente è già in un clan.');
      let invite; try { invite = await target.send({ content: `${message.author} ti invita in **${mine.value.nameoftheclan}**.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`invite-accept:${mine.id}`).setLabel('Accetta').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('invite-deny').setLabel('Rifiuta').setStyle(ButtonStyle.Danger))] }); } catch { return error(message, 'Non posso inviare un DM a questo utente.'); }
      const collected = await invite.awaitMessageComponent({ componentType: ComponentType.Button, time: 120000, filter: i => i.user.id === target.id }).catch(() => null);
      if (!collected || collected.customId === 'invite-deny') return invite.edit({ content: 'Invito rifiutato o scaduto.', components: [] });
      if (await clanOf(client.db, target.id)) return collected.update({ content: 'Sei già entrato in un clan.', components: [] });
      await client.db.push(`${mine.id}.members`, target.id); return collected.update({ content: `Sei entrato in **${mine.value.nameoftheclan}**.`, components: [] });
    }
    if (action === 'kick' || action === 'promote' || action === 'demote') {
      const target = member(message, args[0]); if (!target) return error(message, 'Menziona un utente valido.');
      if (!isOfficer(mine, message.author.id) || !mine.value.members.includes(target.id)) return error(message, 'Operazione non consentita.');
      if (target.id === mine.value.leader) return error(message, 'Non puoi modificare il leader.');
      if (action === 'kick') { if (!isLeader(mine, message.author.id) && !mine.value.mod.includes(message.author.id)) return error(message, 'Solo leader/mod possono espellere.'); await client.db.pull(`${mine.id}.members`, target.id); await client.db.pull(`${mine.id}.mod`, target.id); await client.db.pull(`${mine.id}.coleader`, target.id); return message.reply(`${target} espulso dal clan.`); }
      if (!isLeader(mine, message.author.id)) return error(message, 'Solo il leader può cambiare i ruoli.');
      if (action === 'promote') { await client.db.pull(`${mine.id}.mod`, target.id); await client.db.push(`${mine.id}.coleader`, target.id); return message.reply(`${target} è ora co-leader.`); }
      await client.db.pull(`${mine.id}.coleader`, target.id); await client.db.pull(`${mine.id}.mod`, target.id); return message.reply(`${target} è ora membro.`);
    }
    if (action === 'rename') {
      const name = args.join(' ').trim(); if (!isLeader(mine, message.author.id) || !name || name.length > 15 || !/^[\p{L}\p{N} ]+$/u.test(name)) return error(message, 'Solo il leader può impostare un nome valido.');
      const id = key(name); if (id !== mine.id && await client.db.get(id)) return error(message, 'Nome già in uso.');
      const data = { ...mine.value, nameoftheclan: name }; await client.db.set(id, data); if (id !== mine.id) await client.db.delete(mine.id);
      return message.reply(`Clan rinominato in **${name}**.`);
    }
    if (action === 'result') return error(message, 'Invia lo screen con `=score <match-id> <clan vincitore>`: solo uno Scorer può assegnare l’ELO.');
    return error(message, 'Sottocomando sconosciuto. Usa `clan help`.');
  },
};

const clanSlash = {
  name: 'clan', description: 'Gestisci il tuo clan.',
  options: [
    { name: 'azione', description: 'Azione clan', type: 3, required: true, choices: ['create', 'delete', 'invite', 'kick', 'leave', 'promote', 'demote', 'info', 'rename', 'q', 'result'].map(value => ({ name: value, value })) },
    { name: 'utente', description: 'Utente interessato', type: 6, required: false },
    { name: 'testo', description: 'Nome clan, azione q o altro testo', type: 3, required: false },
  ],
  run: async (client, interaction) => {
    const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const target = interaction.options.getMember('utente'); const text = interaction.options.getString('testo');
    const args = [interaction.options.getString('azione')]; if (target) args.push(target.id); if (text) args.push(...text.split(/\s+/));
    return module.exports.run(client, interactionMessage(interaction, target), args);
  },
};
module.exports.slash = clanSlash;
module.exports.slashes = [clanSlash];
