const { sendError } = require('../../src/bot/functions/sendError');

const fail = (message, description) => sendError('message', message, 'Stagione', description, 'Red');
const isStaff = (client, member, id) => client.config.owners.includes(id) || client.config.developers.includes(id) || Boolean(client.config.role?.staff) && member.roles.cache.has(client.config.role.staff);

module.exports = {
  name: 'season', aliases: ['stagione'], description: 'Gestione stagione e code.', usage: '=season start [nome]',
  run: async (client, message, args) => {
    const action = args.shift()?.toLowerCase() || 'status';
    const current = await client.db.get('system_season') || client.config.season;
    if (action === 'status') return message.reply(`Stagione **${current.name || 'senza nome'}**: ${current.active ? '🟢 attiva' : '🔴 chiusa'}. Coda player: ${current.playerQueue.teams} team da ${current.playerQueue.playersPerTeam}.`);
    if (!isStaff(client, message.member, message.author.id)) return fail(message, 'Solo lo staff può gestire la stagione.');
    if (action === 'start') {
      const updated = { ...current, active: true, startElo: 0, name: args.join(' ').trim().slice(0, 50) || current.name };
      const profiles = (await client.db.all()).filter(entry => entry.id.startsWith('player_profile_'));
      await Promise.all(profiles.map(entry => client.db.set(`player_stats_${entry.id.slice('player_profile_'.length)}`, { elo: 0, wins: 0, losses: 0, winStreak: 0, lossStreak: 0, bestWinStreak: 0 })));
      await client.db.set('system_season', updated); return message.reply(`🟢 Stagione **${updated.name}** avviata: ELO e statistiche azzerati per ${profiles.length} player registrati; entrambe le code sono aperte.`);
    }
    if (action === 'stop') {
      await client.db.set('system_season', { ...current, active: false });
      await client.db.set('player_queue', { members: [] });
      const clanQueues = (await client.db.all()).filter(entry => entry.id.startsWith('clan_queue_'));
      await Promise.all(clanQueues.map(entry => client.db.delete(entry.id)));
      return message.reply('🔴 Stagione chiusa e code svuotate. I match già creati non vengono modificati.');
    }
    return fail(message, 'Usa `=season status`, `=season start [nome]` o `=season stop`.');
  },
};

function seasonSlash(name) {
  return {
    name, description: 'Apri, chiudi o consulta la stagione.',
    options: [
      { name: 'azione', description: 'Azione stagione', type: 3, required: true, choices: ['status', 'start', 'stop'].map(value => ({ name: value, value })) },
      { name: 'nome', description: 'Nome stagione (solo start)', type: 3, required: false },
    ],
    run: async (client, interaction) => { const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const args = [interaction.options.getString('azione')]; const label = interaction.options.getString('nome'); if (label) args.push(...label.split(/\s+/)); return module.exports.run(client, interactionMessage(interaction), args); },
  };
}
module.exports.slash = seasonSlash('season');
module.exports.slashes = [module.exports.slash, seasonSlash('stagione')];
