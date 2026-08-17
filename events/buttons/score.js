const { EmbedBuilder } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');
const { recordPlayerResult, recordClanResult } = require('../../src/bot/functions/elo');

const scorer = (client, member, id) => client.config.owners.includes(id) || client.config.developers.includes(id) || Boolean(client.config.role?.scorer) && member.roles.cache.has(client.config.role.scorer);

module.exports = {
  name: 'interactionCreate',
  run: async (interaction, client) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('score-')) return;
    if (!scorer(client, interaction.member, interaction.user.id)) return sendError('interaction', interaction, 'Permesso negato', 'Solo gli staff con ruolo Scorer possono verificare gli score.', 'Red');
    const [action, reportId] = interaction.customId.split(':'); const report = await client.db.get(reportId);
    if (!report || report.status !== 'pending') return sendError('interaction', interaction, 'Score non disponibile', 'Questo report è già stato gestito.', 'Red');
    const match = await client.db.get(report.matchId);
    if (!match || match.status !== 'scoring') return sendError('interaction', interaction, 'Match non disponibile', 'Il match non è in attesa di verifica.', 'Red');
    if (action === 'score-deny') {
      await client.db.set(`${reportId}.status`, 'rejected'); await client.db.set(`${report.matchId}.status`, 'pending');
      return interaction.update({ embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor('Red').setFooter({ text: `Rifiutato da ${interaction.user.tag}` })], components: [] });
    }
    try {
      let summary;
      if (report.type === 'player') {
        const selectedTeam = /^score-team(\d+)$/.exec(action); const winnerIndex = selectedTeam ? Number(selectedTeam[1]) : report.winner;
        const winnerTeam = match.teams[winnerIndex - 1]; if (!winnerTeam) throw new Error('Team vincitore non valido.');
        const winners = new Set(winnerTeam); const changes = await Promise.all(match.members.map(async id => ({ id, result: await recordPlayerResult(client, id, winners.has(id)) })));
        report.winner = winnerIndex; summary = `Team ${winnerIndex} approvato. ${changes.filter(change => winners.has(change.id)).map(change => `<@${change.id}> +${change.result.change}`).join(' · ')}`;
      } else if (report.type === 'clan') {
        const winner = report.winner; const loser = match.clans.find(id => id !== winner); if (!loser) throw new Error('Clan vincitore non valido.');
        const win = await recordClanResult(client, winner, true); const loss = await recordClanResult(client, loser, false);
        summary = `**${win.clan.nameoftheclan}** +${win.change} ELO · **${loss.clan.nameoftheclan}** ${loss.change} ELO`;
      } else throw new Error('Tipo score non valido.');
      await client.db.set(`${reportId}.status`, 'approved'); await client.db.set(`${reportId}.winner`, report.winner); await client.db.set(`${reportId}.reviewedBy`, interaction.user.id); await client.db.set(`${report.matchId}.status`, 'completed');
      if (match.teamVoiceIds) await Promise.all(match.teamVoiceIds.map(id => interaction.guild.channels.fetch(id).then(channel => channel.delete('Match concluso')).catch(() => null)));
      if (match.scoreChannelId) await interaction.guild.channels.fetch(match.scoreChannelId).then(channel => channel.delete('Match concluso e score approvato')).catch(() => null);
      return interaction.update({ embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor('Green').setFooter({ text: `Approvato da ${interaction.user.tag}` }).addFields({ name: 'Risultato ELO', value: summary.slice(0, 1024) })], components: [] });
    } catch (error) {
      console.error('Score approval failed:', error);
      return sendError('interaction', interaction, 'Aggiornamento ELO non riuscito', 'Il risultato non è stato applicato; riprova o segnala allo sviluppatore.', 'Red');
    }
  },
};
