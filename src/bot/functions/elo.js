const DEFAULT_STATS = { elo: 1000, wins: 0, losses: 0, winStreak: 0, lossStreak: 0, bestWinStreak: 0 };

async function config(client) {
  const value = await client.db.get('elo_config');
  return value || client.config.elo;
}

function rankFor(eloConfig, elo) {
  return [...eloConfig.ranks].sort((a, b) => a.minElo - b.minElo).filter(rank => elo >= rank.minElo).at(-1) || eloConfig.ranks[0];
}

function streakAmount(streak, settings) {
  if (streak < settings.threshold) return 0;
  return Math.min(settings.maxBonus ?? settings.maxPenalty, (streak - settings.threshold + 1) * (settings.bonusPerWin ?? settings.penaltyPerLoss));
}

async function playerStats(client, userId) {
  const season = await client.db.get('system_season') || client.config.season;
  return (await client.db.get(`player_stats_${userId}`)) || { ...DEFAULT_STATS, elo: season?.startElo ?? client.config.eloStart ?? DEFAULT_STATS.elo };
}

async function recordPlayerResult(client, userId, won) {
  const eloConfig = await config(client); const stats = await playerStats(client, userId); const rank = rankFor(eloConfig, stats.elo);
  if (won) {
    stats.wins += 1; stats.winStreak += 1; stats.lossStreak = 0; stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.winStreak);
    const bonus = streakAmount(stats.winStreak, eloConfig.winStreak); const change = rank.win + bonus; stats.elo += change;
    await client.db.set(`player_stats_${userId}`, stats); return { stats, rank: rankFor(eloConfig, stats.elo), change, bonus };
  }
  stats.losses += 1; stats.lossStreak += 1; stats.winStreak = 0;
  const penalty = streakAmount(stats.lossStreak, eloConfig.lossStreak); const change = -(rank.loss + penalty); stats.elo = Math.max(0, stats.elo + change);
  await client.db.set(`player_stats_${userId}`, stats); return { stats, rank: rankFor(eloConfig, stats.elo), change, penalty };
}

async function recordClanResult(client, clanId, won) {
  const clan = await client.db.get(clanId); if (!clan) throw new Error('Clan match references a missing clan.');
  const eloConfig = await config(client); const rank = rankFor(eloConfig, clan.elo ?? client.config.eloStart);
  clan.wins ??= 0; clan.losses ??= 0; clan.winStreak ??= 0; clan.lossStreak ??= 0;
  if (won) {
    clan.wins += 1; clan.winStreak += 1; clan.lossStreak = 0;
    const bonus = streakAmount(clan.winStreak, eloConfig.winStreak); const change = rank.win + bonus; clan.elo += change;
    await client.db.set(clanId, clan); return { clan, rank: rankFor(eloConfig, clan.elo), change, bonus };
  }
  clan.losses += 1; clan.lossStreak += 1; clan.winStreak = 0;
  const penalty = streakAmount(clan.lossStreak, eloConfig.lossStreak); const change = -(rank.loss + penalty); clan.elo = Math.max(0, clan.elo + change);
  await client.db.set(clanId, clan); return { clan, rank: rankFor(eloConfig, clan.elo), change, penalty };
}

module.exports = { config, rankFor, playerStats, recordPlayerResult, recordClanResult };
