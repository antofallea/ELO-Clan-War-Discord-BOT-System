const { sendError } = require('../../src/bot/functions/sendError');

module.exports = {
  name: 'messageCreate',
  run: async (message, client) => {
    if (!message.guild || message.author.bot) return;
    const mention = new RegExp(`^<@!?${client.user.id}>\\s*`);
    const prefix = message.content.match(mention)?.[0] || client.prefix;
    if (!message.content.startsWith(prefix)) return;
    const parts = message.content.slice(prefix.length).trim().split(/\s+/);
    const name = parts.shift()?.toLowerCase();
    if (!name) return;
    const command = client.commands.get(name) || client.commands.find(c => c.aliases?.includes(name));
    if (!command) return;
    const permissions = command.permissions?.member;
    if (permissions?.length && !message.channel.permissionsFor(message.member)?.has(permissions)) {
      return sendError('message', message, 'Permessi mancanti', `Ti servono: ${permissions.join(', ')}`, 'Red');
    }
    try { await command.run(client, message, parts, name); }
    catch (error) {
      console.error(`Command ${name} failed:`, error);
      return sendError('message', message, 'Errore interno', 'Il comando non è stato completato.', 'Red');
    }
  },
};
