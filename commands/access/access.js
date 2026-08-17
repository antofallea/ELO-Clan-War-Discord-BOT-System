const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');

const configKey = 'access_config';
const fail = (message, text) => sendError('message', message, 'Accesso server', text, 'Red');
const staffIds = client => [...new Set([client.config.role?.staff, client.config.role?.scorer, client.config.role?.screenSharer, client.config.role?.seniorScreenSharer, ...client.config.owners, ...client.config.developers].filter(Boolean))];
const staff = (client, member, id) => client.config.owners.includes(id) || client.config.developers.includes(id) || Boolean(client.config.role?.staff) && member.roles.cache.has(client.config.role.staff);
const allowStaff = client => staffIds(client).map(id => ({ id, allow: ['ViewChannel', 'SendMessages', 'Connect', 'Speak', 'MoveMembers', 'ReadMessageHistory'] }));
const allowRoles = (client, names) => [...new Set([...names.map(name => client.config.role?.[name]), ...client.config.owners, ...client.config.developers].filter(Boolean))].map(id => ({ id, allow: ['ViewChannel', 'SendMessages', 'Connect', 'Speak', 'MoveMembers', 'ReadMessageHistory'] }));

async function grantRegisteredAccess(client, member) {
  const access = await client.db.get(configKey); if (!access?.registeredRoleId) return true;
  if (member.roles.cache.has(access.registeredRoleId)) return true;
  await member.roles.add(access.registeredRoleId, 'Registrazione completata'); return true;
}

module.exports = {
  name: 'access', aliases: ['setupaccess'], description: 'Configura accesso registrazione, score, SS e frozen.', usage: '=access setup',
  run: async (client, message, args) => {
    if (!staff(client, message.member, message.author.id)) return fail(message, 'Solo lo staff può configurare gli accessi.');
    const action = args.shift()?.toLowerCase() || 'status'; const existing = await client.db.get(configKey);
    if (action === 'status') return message.reply(existing ? `Ruolo registrati: <@&${existing.registeredRoleId}> · canale register: <#${existing.registerChannelId}> · score: <#${existing.scoreReviewChannelId}> · SS: <#${existing.ssRequestChannelId}> · frozen: <#${existing.frozenVoiceChannelId}>.` : 'Accesso non configurato. Usa `=access setup`.');
    if (action !== 'setup') return fail(message, 'Usa `=access setup` o `=access status`.');
    if (!message.guild.members.me.permissions.has([PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageChannels])) return fail(message, 'Al bot servono Manage Roles e Manage Channels per eseguire il setup.');
    const registeredRole = existing?.registeredRoleId ? message.guild.roles.cache.get(existing.registeredRoleId) : await message.guild.roles.create({ name: 'Registered', reason: 'Ruolo accesso utenti registrati' });
    if (!registeredRole) return fail(message, 'Ruolo Registered non trovato.');
    const registerChannel = existing?.registerChannelId ? message.guild.channels.cache.get(existing.registerChannelId) : await message.guild.channels.create({ name: 'register', type: ChannelType.GuildText, reason: 'Canale registrazione' });
    const scoreReviewChannel = existing?.scoreReviewChannelId ? message.guild.channels.cache.get(existing.scoreReviewChannelId) : await message.guild.channels.create({ name: 'score-review', type: ChannelType.GuildText, reason: 'Canale revisione score' });
    const ssRequestChannel = existing?.ssRequestChannelId ? message.guild.channels.cache.get(existing.ssRequestChannelId) : await message.guild.channels.create({ name: 'ss-requests', type: ChannelType.GuildText, reason: 'Canale richieste screenshare' });
    const frozenVoice = existing?.frozenVoiceChannelId ? message.guild.channels.cache.get(existing.frozenVoiceChannelId) : await message.guild.channels.create({ name: '🔒-frozen', type: ChannelType.GuildVoice, userLimit: 0, reason: 'Vocale utenti freezati' });
    const everyone = message.guild.roles.everyone.id; const privileged = allowStaff(client);
    await registerChannel.permissionOverwrites.set([{ id: everyone, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }, { id: registeredRole.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }, ...privileged]);
    await scoreReviewChannel.permissionOverwrites.set([{ id: everyone, deny: ['ViewChannel'] }, ...allowRoles(client, ['staff', 'scorer'])]);
    await ssRequestChannel.permissionOverwrites.set([{ id: everyone, deny: ['ViewChannel'] }, ...allowRoles(client, ['staff', 'screenSharer', 'seniorScreenSharer'])]);
    await frozenVoice.permissionOverwrites.set([{ id: everyone, deny: ['ViewChannel'] }, ...allowRoles(client, ['staff', 'screenSharer', 'seniorScreenSharer'])]);
    const channels = message.guild.channels.cache.filter(channel => ![registerChannel.id, scoreReviewChannel.id, ssRequestChannel.id, frozenVoice.id].includes(channel.id));
    const botId = message.guild.members.me?.id || client.user?.id;
    const alwaysAllowed = [...new Set([...staffIds(client), botId].filter(Boolean))];
    for (const channel of channels.values()) {
      await channel.permissionOverwrites.edit(everyone, { ViewChannel: false }, { reason: 'Accesso solo utenti registrati' }).catch(() => null);
      await channel.permissionOverwrites.edit(registeredRole.id, { ViewChannel: true }, { reason: 'Accesso utenti registrati' }).catch(() => null);
      await Promise.all(alwaysAllowed.map(id => channel.permissionOverwrites.edit(id, { ViewChannel: true }, { reason: 'Accesso staff e bot' }).catch(() => null)));
    }
    const access = { registeredRoleId: registeredRole.id, registerChannelId: registerChannel.id, scoreReviewChannelId: scoreReviewChannel.id, ssRequestChannelId: ssRequestChannel.id, frozenVoiceChannelId: frozenVoice.id, guildId: message.guild.id };
    await client.db.set(configKey, access);
    const profiles = (await client.db.all()).filter(entry => entry.id.startsWith('player_profile_'));
    await Promise.all(profiles.map(entry => message.guild.members.fetch(entry.id.slice('player_profile_'.length)).then(member => member.roles.add(registeredRole, 'Registrazione esistente')).catch(() => null)));
    await registerChannel.send('Benvenuto! Usa `/register` e inserisci il tuo nome di gioco, oppure `=register <nome>`. Dopo la registrazione vedrai il resto del server.');
    return message.reply(`✅ Accesso configurato. Il solo canale pubblico è ${registerChannel}; gli utenti registrati ricevono <@&${registeredRole.id}>.`);
  },
  grantRegisteredAccess,
  configKey,
};

module.exports.slash = { name: 'access', description: 'Configura accessi del server.', options: [{ name: 'azione', description: 'Azione', type: 3, required: true, choices: [{ name: 'setup', value: 'setup' }, { name: 'status', value: 'status' }] }], run: async (client, interaction) => { const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); return module.exports.run(client, interactionMessage(interaction), [interaction.options.getString('azione')]); } };
module.exports.slashes = [module.exports.slash];
