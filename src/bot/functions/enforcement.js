const freezeKey = userId => `freeze_${userId}`;
const queueBanKey = userId => `queue_ban_${userId}`;

async function activeRecord(client, key) {
  const record = await client.db.get(key);
  if (!record || record.expiresAt > Date.now()) return record;
  await client.db.delete(key); return null;
}

async function getFreeze(client, userId) { return activeRecord(client, freezeKey(userId)); }
async function getQueueBan(client, userId) { return activeRecord(client, queueBanKey(userId)); }

async function releaseFreeze(client, guild, userId) {
  const record = await client.db.get(freezeKey(userId));
  await client.db.delete(freezeKey(userId));
  if (record?.frozenVoiceChannelId) await guild?.channels.fetch(record.frozenVoiceChannelId).then(channel => channel.permissionOverwrites.delete(userId)).catch(() => null);
}

module.exports = { freezeKey, queueBanKey, getFreeze, getQueueBan, releaseFreeze };
