const queue = require('../../commands/queue/queue');
const { getFreeze } = require('../../src/bot/functions/enforcement');

module.exports = {
  name: 'voiceStateUpdate',
  run: async (oldState, newState, client) => {
    if (oldState.member.user.bot) return;
    const frozen = await getFreeze(client, oldState.id);
    if (frozen && newState.channelId && newState.channelId !== frozen.frozenVoiceChannelId) {
      const frozenChannel = newState.guild.channels.cache.get(frozen.frozenVoiceChannelId);
      await newState.member.voice.setChannel(frozenChannel).catch(() => null); return;
    }
    const config = await queue.voiceConfig(client); if (!config) return;
    const entered = newState.channelId === config.voiceChannelId && oldState.channelId !== config.voiceChannelId;
    const left = oldState.channelId === config.voiceChannelId && newState.channelId !== config.voiceChannelId;
    const info = newState.guild.channels.cache.get(config.infoChannelId);
    if (left && await queue.leavePlayerQueue(client, oldState.id)) await info?.send(`<@${oldState.id}> è uscito dalla coda.`).catch(() => null);
    if (entered) {
      const result = await queue.joinPlayerQueue(client, newState.guild, newState.id, info);
      if (result.queued) await info?.send(`<@${newState.id}> è entrato in coda (${result.count}/${result.needed}).`).catch(() => null);
      else if (result.error) await info?.send(`<@${newState.id}> non è entrato in coda: ${result.error}`).catch(() => null);
    }
  },
};
