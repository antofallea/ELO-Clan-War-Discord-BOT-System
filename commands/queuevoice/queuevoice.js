const { ChannelType } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');
const queue = require('../queue/queue');

const key = 'voice_queue_config';
const fail = (message, text) => sendError('message', message, 'Vocale coda', text, 'Red');
const staff = (client, member, id) => client.config.owners.includes(id) || client.config.developers.includes(id) || Boolean(client.config.role?.staff) && member.roles.cache.has(client.config.role.staff);

module.exports = {
  name: 'queuevoice', aliases: ['qvoice'], description: 'Configura la vocale della coda e il picking.', usage: '=queuevoice create 10',
  run: async (client, message, args) => {
    if (!staff(client, message.member, message.author.id)) return fail(message, 'Solo lo staff può configurare la vocale coda.');
    const action = args.shift()?.toLowerCase() || 'status'; const season = await client.db.get('system_season') || client.config.season;
    if (action === 'status') { const config = await client.db.get(key); return message.reply(config ? `Vocale coda: <#${config.voiceChannelId}> · limite ${config.maxPlayers} · picking: ${config.pickingPattern?.join(' ') || 'automatico'}.` : 'Nessuna vocale coda configurata.'); }
    if (action === 'create') {
      const maxPlayers = Number(args.shift()); const needed = season.playerQueue.playersPerTeam * season.playerQueue.teams;
      if (!Number.isInteger(maxPlayers) || maxPlayers < 4 || maxPlayers > 20 || maxPlayers < needed) return fail(message, `Inserisci un limite tra ${needed} e 20.`);
      const old = await client.db.get(key); if (old) return fail(message, `Esiste già una vocale coda: <#${old.voiceChannelId}>. Usa delete prima.`);
      const parent = client.config.voiceQueueCategoryId || undefined;
      const voice = await message.guild.channels.create({ name: '🎮-entra-in-coda', type: ChannelType.GuildVoice, userLimit: maxPlayers, parent, reason: `Vocale coda creata da ${message.author.tag}` });
      const text = await message.guild.channels.create({ name: '📋-coda-info', type: ChannelType.GuildText, parent, reason: `Canale coda creato da ${message.author.tag}` });
      await client.db.set(key, { voiceChannelId: voice.id, infoChannelId: text.id, maxPlayers, categoryId: client.config.matchCategoryId || undefined, pickingPattern: [] });
      await text.send(`Entra nella vocale ${voice} per entrare automaticamente in coda. Quando il match è pieno, inizierà il picking.`);
      return message.reply(`✅ Creata ${voice} con massimo ${maxPlayers} giocatori.`);
    }
    if (action === 'delete') {
      const config = await client.db.get(key); if (!config) return fail(message, 'Nessuna vocale coda configurata.');
      await Promise.all([message.guild.channels.fetch(config.voiceChannelId).then(channel => channel.delete('Vocale coda eliminata')).catch(() => null), message.guild.channels.fetch(config.infoChannelId).then(channel => channel.delete('Canale coda eliminato')).catch(() => null)]); await client.db.delete(key); await client.db.set('player_queue', { members: [] }); return message.reply('Vocale coda eliminata e coda svuotata.');
    }
    if (action === 'pattern') {
      const pattern = args.map(Number); const config = await client.db.get(key); if (!config) return fail(message, 'Crea prima la vocale coda.');
      if (!queue.patternValid(pattern, season.playerQueue)) return fail(message, `Pattern non valido per ${season.playerQueue.teams} team da ${season.playerQueue.playersPerTeam}: servono ${season.playerQueue.playersPerTeam - 1} pick per team. Esempio 2v2: \`1 2\`; 5v5: \`1 2 1 2 1 2 1 2\`.`);
      config.pickingPattern = pattern; await client.db.set(key, config); return message.reply(`✅ Picking impostato: **${pattern.join(' ')}**.`);
    }
    return fail(message, 'Usa `=queuevoice create <max>`, `=queuevoice pattern <sequenza>`, `=queuevoice status` o `=queuevoice delete`.');
  },
};

function slash(name) { return { name, description: 'Configura vocale matchmaking e picking.', options: [{ name: 'azione', description: 'Azione', type: 3, required: true, choices: ['create', 'delete', 'status', 'pattern'].map(value => ({ name: value, value })) }, { name: 'massimo', description: 'Solo create: massimo giocatori', type: 4, required: false }, { name: 'sequenza', description: 'Solo pattern: es. 1 2 1 2', type: 3, required: false }], run: async (client, interaction) => { const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const action = interaction.options.getString('azione'); const args = [action]; if (action === 'create') args.push(String(interaction.options.getInteger('massimo'))); if (action === 'pattern') args.push(...(interaction.options.getString('sequenza') || '').split(/\s+/)); return module.exports.run(client, interactionMessage(interaction), args); } }; }
module.exports.slash = slash('queuevoice');
module.exports.slashes = [module.exports.slash, slash('qvoice')];
