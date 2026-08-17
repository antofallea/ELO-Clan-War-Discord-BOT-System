const { register } = require('../../src/bot/functions/registration');

module.exports = {
  name: 'interactionCreate',
  run: async (interaction, client) => {
    if (!interaction.isModalSubmit() || interaction.customId !== 'register-modal') return;
    const result = await register(client, interaction.user.id, interaction.fields.getTextInputValue('name'));
    if (!result.error) await require('../../commands/access/access').grantRegisteredAccess(client, interaction.member).catch(() => null);
    return interaction.reply({ content: result.error ? `❌ ${result.error}` : `✅ Registrazione completata: **${result.profile.name}**.`, ephemeral: true });
  },
};
