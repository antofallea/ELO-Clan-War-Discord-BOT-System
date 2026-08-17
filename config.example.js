// Copia questo file in config.js e completa gli ID del tuo server.
// Non inserire mai il token qui: usa la variabile d'ambiente DISCORD_TOKEN.
module.exports = {
  token: process.env.DISCORD_TOKEN,
  owners: ['IL_TUO_USER_ID'],
  developers: [],
  default_prefix: '=',
  embeds: { generalcolor: 'FFFFFF' },
  role: {
    staff: '',
    screenSharer: '',
    seniorScreenSharer: '',
    scorer: '',
  },
  channelLogsId: '',
  channelReportsId: '',
  channelScoresId: '',
  tournamentCategoryId: '',
  voiceQueueCategoryId: '',
  matchCategoryId: '',
  maxClanMembers: 10,
  queueEloRange: 200,
  eloKFactor: 32,
  temporaryTournamentMinutes: 240,
  freezeDurationMinutes: 10,
  season: {
    active: false,
    name: 'Season 1',
    startElo: 0,
    playerQueue: { playersPerTeam: 5, teams: 2 },
  },
  elo: {
    ranks: [
      { name: 'Bronze', minElo: 0, win: 25, loss: 15 },
      { name: 'Silver', minElo: 1000, win: 22, loss: 17 },
      { name: 'Gold', minElo: 1500, win: 20, loss: 20 },
      { name: 'Platinum', minElo: 2000, win: 18, loss: 22 },
      { name: 'Diamond', minElo: 2500, win: 16, loss: 25 },
    ],
    winStreak: { threshold: 3, bonusPerWin: 5, maxBonus: 25 },
    lossStreak: { threshold: 3, penaltyPerLoss: 5, maxPenalty: 25 },
  },
};
