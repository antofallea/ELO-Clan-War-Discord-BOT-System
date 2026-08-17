const { sendError } = require('../../src/bot/functions/sendError');

module.exports = {
  name: 'interactionCreate',
  run: async (interaction, client) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return sendError('interaction', interaction, 'Comando non trovato', 'Riprova tra qualche minuto.', 'Red');
    try { await command.run(client, interaction); }
    catch (error) {
      console.error(`Slash command ${interaction.commandName} failed:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await sendError('interaction', interaction, 'Errore interno', 'Il comando non è stato completato.', 'Red');
      }
    }
  },
};
