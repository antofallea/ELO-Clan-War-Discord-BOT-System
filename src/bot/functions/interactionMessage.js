function interactionMessage(interaction, target = null, attachment = null) {
  let replied = false;
  const respond = async (payload, ephemeral = false) => {
    const body = typeof payload === 'string' ? { content: payload } : payload;
    if (!replied && !interaction.replied && !interaction.deferred) { replied = true; return interaction.reply({ ...body, ephemeral }); }
    return interaction.followUp({ ...body, ephemeral });
  };
  return {
    author: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    attachments: { first: () => attachment },
    mentions: { members: { first: () => target }, channels: { first: () => null } },
    reply: payload => respond(payload, true),
    channel: { id: interaction.channelId, send: payload => respond(payload, false) },
  };
}

module.exports = { interactionMessage };
