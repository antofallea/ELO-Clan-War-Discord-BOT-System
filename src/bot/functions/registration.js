const profileKey = userId => `player_profile_${userId}`;

function normalizeName(value) {
  const name = value?.trim().replace(/\s+/g, ' ');
  return name && /^[\p{L}\p{N}_ -]{3,20}$/u.test(name) ? name : null;
}

async function nameTaken(client, name, exceptId = null) {
  const lower = name.toLowerCase();
  return (await client.db.all()).some(entry => entry.id.startsWith('player_profile_') && entry.id !== profileKey(exceptId) && entry.value?.name?.toLowerCase() === lower);
}

async function register(client, userId, value, by = userId, allowEdit = false) {
  const name = normalizeName(value); if (!name) return { error: 'Il nome deve avere 3-20 caratteri e usare solo lettere, numeri, spazi, _ o -.' };
  const existing = await client.db.get(profileKey(userId));
  if (existing && !allowEdit) return { error: `Sei già registrato come **${existing.name}**. Solo lo staff può modificare il nome.` };
  if (await nameTaken(client, name, userId)) return { error: 'Questo nome è già registrato.' };
  const profile = { name, registeredAt: existing?.registeredAt || Date.now(), updatedAt: Date.now(), registeredBy: existing?.registeredBy || by, updatedBy: by };
  await client.db.set(profileKey(userId), profile); return { profile, updated: Boolean(existing) };
}

module.exports = { profileKey, normalizeName, nameTaken, register };
