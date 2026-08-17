const { Events, ChannelType, EmbedBuilder } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');

module.exports = {
  name: Events.InteractionCreate,
  run: async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('clan-')) return;
    const [action, id] = interaction.customId.split(':');
    if (!interaction.member.roles.cache.has(client.config.channelRequestsRoleId)) {
      return sendError('interaction', interaction, 'Permessi mancanti', 'Solo lo staff può gestire le richieste clan.', 'Red');
    }
    const clan = await client.db.get(id);
    if (!clan || clan.status !== 'Creating') return sendError('interaction', interaction, 'Richiesta non disponibile', 'È già stata gestita o rimossa.', 'Red');
    if (action === 'clan-deny') {
      await client.db.delete(id);
      await interaction.update({ embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor('Red').setFooter({ text: `Rifiutata da ${interaction.user.tag}` })], components: [] });
      return interaction.guild.members.fetch(clan.leader).then(m => m.send(`La richiesta per **${clan.nameoftheclan}** è stata rifiutata.`)).catch(() => null);
    }
    try {
      const overwrites = [
        { id: interaction.guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: clan.leader, allow: ['ViewChannel', 'SendMessages', 'Connect', 'Speak', 'ManageMessages'] },
        ...(client.config.channelRequestsRoleId ? [{ id: client.config.channelRequestsRoleId, allow: ['ViewChannel', 'SendMessages', 'Connect'] }] : []),
      ];
      const voice = await interaction.guild.channels.create({ name: `[${clan.nameoftheclan}] vocal`, type: ChannelType.GuildVoice, parent: client.config.parentChannelcreate || undefined, permissionOverwrites: overwrites });
      const text = await interaction.guild.channels.create({ name: `${clan.nameoftheclan}-general`, type: ChannelType.GuildText, parent: client.config.parentChannelcreate || undefined, permissionOverwrites: overwrites });
      await client.db.set(`${id}.vocal`, voice.id); await client.db.set(`${id}.text`, text.id); await client.db.set(`${id}.status`, 'Created');
      await interaction.update({ embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor('Green').setFooter({ text: `Accettata da ${interaction.user.tag}` })], components: [] });
      return interaction.guild.members.fetch(clan.leader).then(m => m.send(`Il clan **${clan.nameoftheclan}** è stato approvato: ${text} / ${voice}`)).catch(() => null);
    } catch (error) {
      console.error('Creating clan channels failed:', error);
      return sendError('interaction', interaction, 'Creazione non riuscita', 'Verifica categoria e permessi del bot.', 'Red');
    }
  },
};
