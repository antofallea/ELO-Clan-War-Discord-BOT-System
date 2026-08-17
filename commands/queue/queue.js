const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');
const { profileKey } = require('../../src/bot/functions/registration');
const { getFreeze, getQueueBan } = require('../../src/bot/functions/enforcement');

const stateKey = 'system_season';
const queueKey = 'player_queue';
const voiceQueueKey = 'voice_queue_config';
const error = (message, description) => sendError('message', message, 'Coda giocatori', description, 'Red');
const isStaff = (client, member, id) => client.config.owners.includes(id) || client.config.developers.includes(id) || Boolean(client.config.role?.staff) && member.roles.cache.has(client.config.role.staff);
const state = async client => (await client.db.get(stateKey)) || client.config.season;
const requiredPlayers = season => season.playerQueue.playersPerTeam * season.playerQueue.teams;
const defaultPattern = ({ playersPerTeam, teams }) => Array.from({ length: playersPerTeam - 1 }, () => Array.from({ length: teams }, (_, index) => index + 1)).flat();
const patternValid = (pattern, config) => pattern.length === requiredPlayers({ playerQueue: config }) - config.teams && pattern.every(team => Number.isInteger(team) && team >= 1 && team <= config.teams) && Array.from({ length: config.teams }, (_, index) => pattern.filter(team => team === index + 1).length).every(count => count === config.playersPerTeam - 1);
const staffOverwrites = client => [...new Set([client.config.role?.staff, ...client.config.owners, ...client.config.developers].filter(Boolean))].map(id => ({ id, allow: ['ViewChannel', 'Connect', 'Speak', 'MoveMembers', 'SendMessages', 'ReadMessageHistory'] }));

async function voiceConfig(client) { return await client.db.get(voiceQueueKey); }

function pickingView(match) {
  const nextTeam = match.pickPattern[match.pickIndex];
  const description = match.teams.map((team, index) => `**Team ${index + 1}** — ${team.map(id => `<@${id}>`).join(' ')}`).join('\n\n');
  const buttons = match.unpicked.map((id, index) => new ButtonBuilder().setCustomId(`pick:${match.id}:${id}`).setLabel(match.names?.[id]?.slice(0, 80) || `Player ${index + 1}`).setStyle(ButtonStyle.Primary));
  const rows = Array.from({ length: Math.ceil(buttons.length / 5) }, (_, index) => new ActionRowBuilder().addComponents(buttons.slice(index * 5, index * 5 + 5)));
  return { embeds: [new EmbedBuilder().setColor('Gold').setTitle('🎯 Fase di picking').setDescription(`${description}\n\nTocca al capitano del **Team ${nextTeam}** di scegliere un player.`).setFooter({ text: `Pick ${match.pickIndex + 1}/${match.pickPattern.length}` })], components: rows };
}

async function classicMatch(client, channel, season, members) {
  const { playersPerTeam, teams } = season.playerQueue; const shuffled = [...members].sort(() => Math.random() - 0.5);
  const matchTeams = Array.from({ length: teams }, (_, index) => shuffled.slice(index * playersPerTeam, (index + 1) * playersPerTeam));
  const matchId = `player_match_${Date.now()}`;
  await client.db.set(matchId, { id: matchId, type: 'player', members: shuffled, teams: matchTeams, playersPerTeam, createdAt: Date.now(), status: 'pending' });
  return channel.send({ embeds: [new EmbedBuilder().setColor('Gold').setTitle('⚔️ Match trovato').setDescription(matchTeams.map((team, index) => `**Team ${index + 1}** — ${team.map(id => `<@${id}>`).join(' ')}`).join('\n\n')).setFooter({ text: `Match ID: ${matchId} • Season: ${season.name || 'attiva'}` })] });
}

async function startPickingMatch(client, guild, season, members, config, channel) {
  const id = `player_match_${Date.now()}`; const shuffled = [...members].sort(() => Math.random() - 0.5); const captains = shuffled.splice(0, season.playerQueue.teams);
  const fetched = await Promise.all(members.map(id => guild.members.fetch(id))); const names = Object.fromEntries(fetched.map(member => [member.id, member.displayName]));
  const overwrites = [{ id: guild.roles.everyone.id, deny: ['ViewChannel'] }, ...members.map(id => ({ id, allow: ['ViewChannel', 'Connect', 'Speak', 'SendMessages', 'ReadMessageHistory'] })), ...staffOverwrites(client)];
  const lobby = await guild.channels.create({ name: `match-${id.slice(-6)}-lobby`, type: ChannelType.GuildVoice, userLimit: members.length, parent: config.categoryId || undefined, permissionOverwrites: overwrites, reason: 'Lobby picking creata dal matchmaking' });
  const text = await guild.channels.create({ name: `pick-${id.slice(-6)}`, type: ChannelType.GuildText, parent: config.categoryId || undefined, permissionOverwrites: overwrites, reason: 'Canale picking creato dal matchmaking' });
  const pickPattern = config.pickingPattern?.length ? config.pickingPattern : defaultPattern(season.playerQueue);
  const match = { id, type: 'player', status: 'picking', members, teams: captains.map(id => [id]), captains, unpicked: shuffled, pickPattern, pickIndex: 0, playersPerTeam: season.playerQueue.playersPerTeam, createdAt: Date.now(), lobbyVoiceId: lobby.id, pickingChannelId: text.id, names };
  await client.db.set(id, match); await Promise.all(fetched.map(member => member.voice.setChannel(lobby).catch(() => null)));
  const pickMessage = await text.send(pickingView(match)); await client.db.set(`${id}.pickingMessageId`, pickMessage.id);
  await channel?.send?.(`⚔️ Match creato: i player sono stati spostati in ${lobby}; il picking avviene in ${text}.`);
  return match;
}

async function finalizePicking(client, guild, match, interaction) {
  const config = await voiceConfig(client);
  const voices = await Promise.all(match.teams.map((team, index) => guild.channels.create({ name: `match-${match.id.slice(-6)}-team-${index + 1}`, type: ChannelType.GuildVoice, userLimit: match.playersPerTeam, parent: config?.categoryId || undefined, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ['ViewChannel'] }, ...team.map(id => ({ id, allow: ['ViewChannel', 'Connect', 'Speak'] })), ...staffOverwrites(client)], reason: 'Team privato creato dopo picking' })));
  const text = await guild.channels.fetch(match.pickingChannelId); await text.setName(`score-${match.id.slice(-6)}`);
  match.status = 'pending'; match.teamVoiceIds = voices.map(voice => voice.id); match.scoreChannelId = text.id; match.unpicked = []; match.pickIndex = match.pickPattern.length;
  await client.db.set(match.id, match);
  await Promise.all(match.teams.flatMap((team, index) => team.map(async id => { const member = await guild.members.fetch(id); return member.voice.setChannel(voices[index]).catch(() => null); })));
  await guild.channels.fetch(match.lobbyVoiceId).then(channel => channel.delete('Picking completato')).catch(() => null);
  return interaction.update({ embeds: [new EmbedBuilder().setColor('Green').setTitle('✅ Match pronto').setDescription(`${match.teams.map((team, index) => `**Team ${index + 1}** — ${team.map(id => `<@${id}>`).join(' ')}`).join('\n\n')}\n\nScore: ${text}`).setFooter({ text: `Match ID: ${match.id}` })], components: [] });
}

async function joinPlayerQueue(client, guild, userId, channel) {
  const season = await state(client); if (!season?.active) return { error: 'La stagione non è attiva.' };
  if (!await client.db.get(profileKey(userId))) return { error: 'Devi prima registrarti con `=register <nome>` o `/register`.' };
  const freeze = await getFreeze(client, userId); if (freeze) return { error: `Sei freezato fino al <t:${Math.floor(freeze.expiresAt / 1000)}:R> e puoi entrare solo nella vocale Frozen.` };
  const ban = await getQueueBan(client, userId); if (ban) return { error: `Sei bannato dalla coda fino al <t:${Math.floor(ban.expiresAt / 1000)}:R>.` };
  const current = await client.db.get(queueKey) || { members: [] }; const needed = requiredPlayers(season);
  if (current.members.includes(userId)) return { queued: true, count: current.members.length, needed };
  current.members.push(userId);
  if (current.members.length < needed) { await client.db.set(queueKey, current); return { queued: true, count: current.members.length, needed }; }
  const group = current.members.splice(0, needed); await client.db.set(queueKey, current);
  const config = await voiceConfig(client);
  if (config) await startPickingMatch(client, guild, season, group, config, channel);
  else await classicMatch(client, channel, season, group);
  return { started: true, count: current.members.length, needed };
}

async function leavePlayerQueue(client, userId) {
  const current = await client.db.get(queueKey) || { members: [] }; if (!current.members.includes(userId)) return false;
  current.members = current.members.filter(id => id !== userId); await client.db.set(queueKey, current); return true;
}

module.exports = {
  name: 'queue', aliases: ['q'], description: 'Coda matchmaking giocatori.', usage: '=q join',
  run: async (client, message, args) => {
    const action = args.shift()?.toLowerCase() || 'status'; const season = await state(client);
    if (action === 'config') {
      if (!isStaff(client, message.member, message.author.id)) return error(message, 'Solo lo staff può configurare la coda.');
      const playersPerTeam = Number(args[0]); const teams = Number(args[1]); const total = playersPerTeam * teams; const config = await voiceConfig(client);
      if (!Number.isInteger(playersPerTeam) || !Number.isInteger(teams) || playersPerTeam < 2 || playersPerTeam > 10 || teams < 2 || teams > 4 || total > 20 || config && total > config.maxPlayers) return error(message, `Valori non validi. Usa 2-10 player per team, 2-4 team e massimo ${config?.maxPlayers || 20} player totali.`);
      const updated = { ...season, playerQueue: { playersPerTeam, teams } }; await client.db.set(stateKey, updated); await client.db.set(queueKey, { members: [] });
      if (config?.pickingPattern?.length && !patternValid(config.pickingPattern, updated.playerQueue)) { config.pickingPattern = []; await client.db.set(voiceQueueKey, config); }
      return message.reply(`✅ Coda impostata su **${teams} team** da **${playersPerTeam} giocatori**. Coda svuotata.`);
    }
    if (!season?.active) return error(message, 'La coda è chiusa: la stagione non è attiva.');
    const current = await client.db.get(queueKey) || { members: [] }; const needed = requiredPlayers(season); const config = await voiceConfig(client);
    if (action === 'status') return message.reply(`Coda: **${current.members.length}/${needed}** giocatori — ${season.playerQueue.teams} team da ${season.playerQueue.playersPerTeam}.${config ? ` Entra in ${message.guild.channels.cache.get(config.voiceChannelId) || 'vocale coda'}.` : ''}`);
    if (action === 'leave') return (await leavePlayerQueue(client, message.author.id)) ? message.reply('Sei uscito dalla coda.') : error(message, 'Non sei in coda.');
    if (action !== 'join') return error(message, 'Usa `=q join`, `=q leave`, `=q status` oppure `=q config`.');
    if (config && message.member.voice.channelId !== config.voiceChannelId) return error(message, `Devi prima entrare nella vocale coda <#${config.voiceChannelId}>.`);
    const result = await joinPlayerQueue(client, message.guild, message.author.id, message.channel); return result.started ? message.reply('✅ Match avviato: controlla il canale di picking.') : result.queued ? message.reply(`✅ Sei entrato in coda (${result.count}/${result.needed}).`) : error(message, result.error);
  },
  joinPlayerQueue, leavePlayerQueue, voiceConfig, patternValid, pickingView, finalizePicking,
};

function queueSlash(name) { return { name, description: 'Entra o configura la coda giocatori.', options: [{ name: 'azione', description: 'Azione coda', type: 3, required: true, choices: ['join', 'leave', 'status', 'config'].map(value => ({ name: value, value })) }, { name: 'giocatori_per_team', description: 'Solo config', type: 4, required: false }, { name: 'team', description: 'Solo config', type: 4, required: false }], run: async (client, interaction) => { const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const action = interaction.options.getString('azione'); const args = [action]; if (action === 'config') args.push(String(interaction.options.getInteger('giocatori_per_team')), String(interaction.options.getInteger('team'))); return module.exports.run(client, interactionMessage(interaction), args); } }; }
module.exports.slash = queueSlash('queue');
module.exports.slashes = [module.exports.slash, queueSlash('q')];
