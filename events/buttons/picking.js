const { sendError } = require('../../src/bot/functions/sendError');
const queue = require('../../commands/queue/queue');

module.exports = {
  name: 'interactionCreate',
  run: async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('pick:')) return;
    const [, matchId, playerId] = interaction.customId.split(':'); const match = await client.db.get(matchId);
    if (!match || match.status !== 'picking') return sendError('interaction', interaction, 'Picking non disponibile', 'Questo match non è più in picking.', 'Red');
    const teamIndex = match.pickPattern[match.pickIndex] - 1;
    if (match.captains[teamIndex] !== interaction.user.id) return sendError('interaction', interaction, 'Non è il tuo turno', `Tocca al capitano del Team ${teamIndex + 1}.`, 'Red');
    if (!match.unpicked.includes(playerId)) return sendError('interaction', interaction, 'Player già scelto', 'Ricarica il messaggio picking.', 'Red');
    match.teams[teamIndex].push(playerId); match.unpicked = match.unpicked.filter(id => id !== playerId); match.pickIndex += 1; await client.db.set(matchId, match);
    if (!match.unpicked.length) return queue.finalizePicking(client, interaction.guild, match, interaction);
    return interaction.update(queue.pickingView(match));
  },
};
