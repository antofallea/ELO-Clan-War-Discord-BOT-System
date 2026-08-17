const assert = require('node:assert/strict');
const clan = require('../commands/clansys/clan');
const queue = require('../commands/queue/queue');
const season = require('../commands/season/season');
const staff = require('../commands/moderation/staff');
const { recordPlayerResult, playerStats } = require('../src/bot/functions/elo');
const scoreButtons = require('../events/buttons/score');
const { EmbedBuilder, Collection } = require('discord.js');
const { register } = require('../src/bot/functions/registration');
const access = require('../commands/access/access');
const { getQueueBan } = require('../src/bot/functions/enforcement');
const score = require('../commands/scoring/score');

class MemoryDb {
  constructor() { this.data = new Map(); }
  async get(key) { const [root, ...path] = key.split('.'); return path.reduce((value, part) => value?.[part], this.data.get(root)); }
  async set(key, value) { const [root, ...path] = key.split('.'); if (!path.length) { this.data.set(root, value); return value; } const record = this.data.get(root) || {}; let current = record; for (const part of path.slice(0, -1)) current = current[part] ||= {}; current[path.at(-1)] = value; this.data.set(root, record); return value; }
  async delete(key) { this.data.delete(key); }
  async all() { return [...this.data].map(([id, value]) => ({ id, value })); }
}

const makeMessage = (id, sent, target = null, overrides = {}) => ({
  author: { id, bot: false, tag: id, username: id },
  member: { roles: { cache: { has: () => false, some: () => false } } },
  mentions: { members: { first: () => target }, channels: { first: () => null } },
  guild: { members: { cache: { get: () => null, find: () => null } }, channels: { cache: { get: () => null } } },
  channel: { send: async value => sent.push(value) },
  reply: async value => sent.push(value),
  ...overrides,
});

async function run() {
  const db = new MemoryDb(); const sent = [];
  const client = {
    db, prefix: '=', channels: { cache: { get: () => null } },
    config: { owners: ['staff'], developers: [], role: { staff: '' }, season: { active: false, name: 'Test', playerQueue: { playersPerTeam: 5, teams: 2 } }, queueEloRange: 200, eloKFactor: 32, eloStart: 1000, elo: { ranks: [{ name: 'Bronze', minElo: 0, win: 20, loss: 10 }], winStreak: { threshold: 2, bonusPerWin: 5, maxBonus: 15 }, lossStreak: { threshold: 2, penaltyPerLoss: 5, maxPenalty: 15 } } },
  };
  await db.set('player_profile_resetMe', { name: 'Reset Me' }); await db.set('player_stats_resetMe', { elo: 1777, wins: 12, losses: 1, winStreak: 8, lossStreak: 0, bestWinStreak: 8 });
  await season.run(client, makeMessage('staff', sent), ['start', 'Test Season']);
  assert.equal((await db.get('system_season')).active, true, 'season should open');
  assert.deepEqual(await db.get('player_stats_resetMe'), { elo: 0, wins: 0, losses: 0, winStreak: 0, lossStreak: 0, bestWinStreak: 0 }, 'season start should reset every registered player to 0 ELO');
  await queue.run(client, makeMessage('staff', sent), ['config', '2', '2']);
  const firstRegistration = await register(client, 'registered', 'Player One'); const duplicateRegistration = await register(client, 'registered', 'Different Name'); const staffEdit = await register(client, 'registered', 'Updated Name', 'staff', true);
  assert.equal(firstRegistration.profile.name, 'Player One', 'registration should persist the submitted name');
  assert.ok(duplicateRegistration.error, 'users cannot register or rename twice');
  assert.equal(staffEdit.profile.name, 'Updated Name', 'staff should be able to edit a registered name');
  for (const id of ['p1', 'p2', 'p3', 'p4', 'v1', 'v2', 'v3', 'v4']) await db.set(`player_profile_${id}`, { name: id });
  for (const id of ['p1', 'p2', 'p3', 'p4']) await queue.run(client, makeMessage(id, sent), ['join']);
  assert.equal((await db.get('player_queue')).members.length, 0, 'a complete player queue must create a match and empty the slots');
  assert.equal((await db.all()).filter(x => x.id.startsWith('player_match_')).length, 1, 'player match should be persisted');

  await db.set('clan_alpha', { leader: 'a1', nameoftheclan: 'Alpha', members: ['a1', 'a2'], mod: [], coleader: [], status: 'Created', elo: 1000 });
  await db.set('clan_beta', { leader: 'b1', nameoftheclan: 'Beta', members: ['b1', 'b2'], mod: [], coleader: [], status: 'Created', elo: 1010 });
  for (const id of ['a1', 'a2', 'b1', 'b2']) await clan.run(client, makeMessage(id, sent), ['q', 'ready']);
  await clan.run(client, makeMessage('a1', sent), ['q', 'join']);
  assert.ok(await db.get('clan_queue_clan_alpha'), 'a fully ready clan must enter the clan queue');
  await clan.run(client, makeMessage('b1', sent), ['q', 'join']);
  assert.equal((await db.all()).filter(x => x.id.startsWith('match_')).length, 1, 'compatible ready clans must create a persisted match');

  const target = { id: 'reported', user: { id: 'reported', bot: false, tag: 'reported' }, voice: { setChannel: async channel => { target.frozenChannel = channel.id; } }, toString: () => '<@reported>' };
  const reportChannel = { send: async value => sent.push(value) };
  client.config.channelReportsId = 'reports'; client.channels.cache.get = id => id === 'reports' ? reportChannel : null;
  await staff.run(client, makeMessage('p1', sent, target), ['@reported', 'test'], 'report');
  assert.ok(sent.some(value => value?.embeds?.[0]?.data?.title === 'Nuovo report'), 'report should reach the configured channel');
  await staff.run(client, makeMessage('staff', sent, target), ['@reported', 'test strike'], 'strike');
  assert.equal((await db.get('discipline_reported')).strikes, 1, 'strike counter should persist');
  await db.set('player_profile_reported', { name: 'reported' });
  const frozenVoice = { id: 'frozen', toString: () => '<#frozen>', permissionOverwrites: { edit: async () => {}, delete: async () => {} } };
  await db.set('access_config', { frozenVoiceChannelId: 'frozen' });
  client.config.role.screenSharer = 'screen';
  const screenMessage = makeMessage('screenUser', sent, target, {
    member: { roles: { cache: { has: id => id === 'screen', some: callback => callback({ id: 'screen' }) } } },
    guild: {
      members: { cache: { get: () => null, find: () => null } },
      channels: { cache: { get: id => id === 'frozen' ? frozenVoice : null }, fetch: async id => id === 'frozen' ? frozenVoice : null },
    },
  });
  await staff.run(client, screenMessage, ['@reported', '10m', 'check'], 'freeze');
  assert.equal(target.frozenChannel, 'frozen', 'screen sharer should move a frozen player into the frozen voice channel');
  assert.ok(await db.get('freeze_reported'), 'freeze state should persist');
  assert.match((await queue.joinPlayerQueue(client, null, 'reported')).error, /freezato/, 'a frozen player must not enter queue');
  await staff.run(client, makeMessage('staff', sent, target), ['@reported', '7', 'test ban'], 'ban');
  assert.ok(await db.get('queue_ban_reported'), 'staff ban should prevent queue access for the configured days');
  await staff.run(client, screenMessage, ['@reported'], 'unfreeze');
  assert.equal(await db.get('freeze_reported'), undefined, 'unfreeze must clear the freeze state');
  assert.match((await queue.joinPlayerQueue(client, null, 'reported')).error, /bannato dalla coda/, 'a queue-banned player must not enter queue');
  await db.set('queue_ban_expired', { expiresAt: Date.now() - 1 });
  assert.equal(await getQueueBan(client, 'expired'), null, 'expired queue bans must be released automatically');
  const tournamentChannel = { id: 'tournament-1', toString: () => '<#tournament-1>', delete: async () => {} };
  const tournamentMessage = makeMessage('staff', sent, null, { guild: { members: { cache: { get: () => null, find: () => null } }, channels: { cache: { get: () => null }, create: async () => tournamentChannel } } });
  await staff.run(client, tournamentMessage, ['create', '4', 'cup'], 'tournament');
  assert.equal((await db.get('tournament_tournament-1')).playerLimit, 4, 'tournament room should persist its player limit');
  await recordPlayerResult(client, 'eloPlayer', true); const secondWin = await recordPlayerResult(client, 'eloPlayer', true); await recordPlayerResult(client, 'eloPlayer', false);
  const eloStats = await playerStats(client, 'eloPlayer');
  assert.equal(secondWin.change, 25, 'configured win streak bonus should apply after its threshold');
  assert.deepEqual({ elo: eloStats.elo, wins: eloStats.wins, losses: eloStats.losses }, { elo: 35, wins: 2, losses: 1 }, 'ELO result, win and loss counters should persist');
  await db.set('player_match_score', { type: 'player', status: 'pending', members: ['scoreWinner', 'scoreLoser'], teams: [['scoreWinner'], ['scoreLoser']], teamVoiceIds: ['team-a', 'team-b'], scoreChannelId: 'score-text' });
  let scoreReviewPayload;
  client.channels.cache.get = id => id === 'score-review' ? { send: async payload => { scoreReviewPayload = payload; } } : null;
  await db.set('access_config', { scoreReviewChannelId: 'score-review' });
  const scoreMessage = makeMessage('scoreWinner', sent, null, { channel: { id: 'score-text', send: async value => sent.push(value) }, attachments: { first: () => ({ contentType: 'image/png', url: 'https://example.test/vittoria.png' }) } });
  await score.run(client, scoreMessage, ['player_match_score', '1']);
  const scoreReview = (await db.all()).find(entry => entry.id.startsWith('score_'));
  assert.ok(scoreReview, 'a score with image proof should create a private review request');
  assert.equal((await db.get('player_match_score')).status, 'scoring', 'score submission must lock the match while it is reviewed');
  assert.equal(scoreReviewPayload.components[0].components.length, 3, 'review request must offer both team winners and deny');
  const deletedMatchChannels = []; const approval = { isButton: () => true, customId: `score-team1:${scoreReview.id}`, user: { id: 'staff', tag: 'staff' }, member: { roles: { cache: { has: () => false } } }, guild: { channels: { fetch: async id => ({ delete: async () => deletedMatchChannels.push(id) }) } }, message: { embeds: [new EmbedBuilder().setTitle('Score') ] }, update: async value => { approval.updated = value; } };
  await scoreButtons.run(approval, client);
  assert.equal((await db.get('player_match_score')).status, 'completed', 'Scorer approval should complete the match');
  assert.equal((await playerStats(client, 'scoreWinner')).wins, 1, 'Scorer approval should register the winning player');
  assert.equal((await playerStats(client, 'scoreLoser')).losses, 1, 'Scorer approval should register the losing player');
  assert.deepEqual(deletedMatchChannels.sort(), ['score-text', 'team-a', 'team-b'], 'approved score should delete both team voices and the match score channel');

  assert.equal(queue.patternValid([1, 2], { playersPerTeam: 2, teams: 2 }), true, 'balanced 2v2 picking pattern should be valid');
  assert.equal(queue.patternValid([1, 1], { playersPerTeam: 2, teams: 2 }), false, 'unbalanced picking pattern should be rejected');
  const created = new Map(); let channelNumber = 0;
  const voiceGuild = {
    roles: { everyone: { id: 'everyone' } },
    members: { fetch: async id => ({ id, displayName: `User-${id}`, voice: { setChannel: async channel => { created.get(`member-${id}`)?.push(channel.id); } } }) },
    channels: {
      create: async options => { const channel = { id: `created-${++channelNumber}`, ...options, send: async () => ({ id: `message-${channelNumber}` }), setName: async name => { channel.name = name; }, delete: async () => {} }; created.set(channel.id, channel); return channel; },
      fetch: async id => created.get(id),
      cache: { get: () => null },
    },
  };
  await db.set('voice_queue_config', { voiceChannelId: 'queue-voice', infoChannelId: 'queue-info', maxPlayers: 4, pickingPattern: [] });
  const announcement = { send: async value => sent.push(value) };
  for (const id of ['v1', 'v2', 'v3', 'v4']) await queue.joinPlayerQueue(client, voiceGuild, id, announcement);
  const pickingMatch = (await db.all()).find(entry => entry.value?.status === 'picking')?.value;
  assert.ok(pickingMatch, 'a full voice queue should start the picking lobby');
  assert.equal(pickingMatch.unpicked.length, 2, 'two captains should be selected before the remaining picks');
  while (pickingMatch.unpicked.length) { const team = pickingMatch.pickPattern[pickingMatch.pickIndex] - 1; pickingMatch.teams[team].push(pickingMatch.unpicked.shift()); pickingMatch.pickIndex += 1; }
  await queue.finalizePicking(client, voiceGuild, pickingMatch, { update: async value => { pickingMatch.final = value; } });
  const completedVoiceMatch = await db.get(pickingMatch.id);
  assert.equal(completedVoiceMatch.status, 'pending', 'finished picking should produce a pending playable match');
  assert.equal(completedVoiceMatch.teamVoiceIds.length, 2, 'finished picking should create one voice channel per team');
  assert.ok(completedVoiceMatch.scoreChannelId, 'finished picking should create a shared score channel');

  const accessEdits = []; const specialSets = [];
  const registeredRole = { id: 'registered-role' };
  const specialChannel = id => ({ id, permissionOverwrites: { set: async overwrites => specialSets.push({ id, overwrites }) }, send: async value => sent.push(value) });
  const existingChannel = { id: 'general', permissionOverwrites: { edit: async (id, permissions) => accessEdits.push({ id, permissions }) } };
  const registerChannel = specialChannel('register-channel');
  const accessGuild = {
    id: 'guild-access',
    roles: { everyone: { id: 'everyone' }, cache: { get: id => id === registeredRole.id ? registeredRole : null } },
    members: {
      me: { id: 'bot-user', permissions: { has: () => true } },
      fetch: async () => ({
        roles: {
          add: async role => { assert.equal(role.id, registeredRole.id, 'existing registrations receive the Registered role'); },
        },
      }),
    },
    channels: { cache: new Collection([['register-channel', registerChannel], ['score-channel', specialChannel('score-channel')], ['ss-channel', specialChannel('ss-channel')], ['frozen-channel', specialChannel('frozen-channel')], ['general', existingChannel]]) },
  };
  await db.set('access_config', { registeredRoleId: 'registered-role', registerChannelId: 'register-channel', scoreReviewChannelId: 'score-channel', ssRequestChannelId: 'ss-channel', frozenVoiceChannelId: 'frozen-channel' });
  await access.run(client, makeMessage('staff', sent, null, { guild: accessGuild }), ['setup']);
  assert.equal(specialSets.length, 4, 'access setup should configure every protected channel');
  assert.ok(accessEdits.some(edit => edit.id === 'everyone' && edit.permissions.ViewChannel === false), 'unregistered users must be denied existing channels');
  assert.ok(accessEdits.some(edit => edit.id === 'registered-role' && edit.permissions.ViewChannel === true), 'registered users must see existing channels');
  assert.ok(accessEdits.some(edit => edit.id === 'staff' && edit.permissions.ViewChannel === true), 'staff must retain access to existing channels');
  assert.ok(accessEdits.some(edit => edit.id === 'bot-user' && edit.permissions.ViewChannel === true), 'the bot must retain access to existing channels');
  console.log('Queue and season behaviour tests passed');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
