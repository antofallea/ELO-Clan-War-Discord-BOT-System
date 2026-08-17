const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');

const fail = (message, description) => sendError('message', message, 'Score', description, 'Red');
const image = attachment => attachment && (attachment.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(attachment.url));

module.exports = {
  name: 'score', description: 'Invia lo screen della vittoria allo staff Scorer.', usage: '=score <match-id> <team/clan vincitore> con un allegato immagine',
  run: async (client, message, args) => {
    const matchId = args.shift(); const attachment = message.attachments?.first();
    if (!matchId || !image(attachment)) return fail(message, 'Uso: `=score <match-id> <team o clan vincitore>` allegando uno screen PNG/JPG/WebP/GIF.');
    const match = await client.db.get(matchId);
    if (!match || !['pending', 'scoring'].includes(match.status)) return fail(message, 'Match non trovato o già concluso.');
    if (match.scoreChannelId && message.channel.id !== match.scoreChannelId) return fail(message, `Lo score deve essere inviato nel canale <#${match.scoreChannelId}> del match.`);
    if (match.status === 'scoring') return fail(message, 'Per questo match esiste già uno score in revisione.');
    let winner; let type;
    if (match.type === 'player' || Array.isArray(match.teams)) {
      type = 'player'; winner = Number(args.shift());
      if (!Array.isArray(match.teams)) return fail(message, 'Questo vecchio match non contiene le squadre: crea una nuova coda prima di inviare lo score.');
      if (!Number.isInteger(winner) || winner < 1 || winner > match.teams.length) return fail(message, `Indica un team da 1 a ${match.teams.length}.`);
      if (!match.members.includes(message.author.id)) return fail(message, 'Può inviare lo score solo un giocatore del match.');
    } else if (match.type === 'clan' || Array.isArray(match.clans)) {
      type = 'clan'; const name = args.join(' ').trim().toLowerCase(); const clans = await Promise.all(match.clans.map(id => client.db.get(id)));
      const participant = clans.some(clan => clan?.members.includes(message.author.id));
      winner = match.clans[clans.findIndex(clan => clan?.nameoftheclan.toLowerCase() === name)];
      if (!participant) return fail(message, 'Può inviare lo score solo un membro dei clan del match.');
      if (!winner) return fail(message, 'Indica il nome esatto del clan vincitore.');
    } else return fail(message, 'Tipo di match non supportato.');
    const access = await client.db.get('access_config'); const destination = client.channels.cache.get(access?.scoreReviewChannelId || client.config.channelScoresId || client.config.channelLogsId);
    if (!destination) return fail(message, 'Canale score non configurato.');
    const reportId = `score_${Date.now()}`;
    await client.db.set(reportId, { id: reportId, matchId, type, winner, reporter: message.author.id, screenshot: attachment.url, status: 'pending', createdAt: Date.now() });
    await client.db.set(`${matchId}.status`, 'scoring');
    const resultButtons = type === 'player'
      ? match.teams.map((_, index) => new ButtonBuilder().setCustomId(`score-team${index + 1}:${reportId}`).setLabel(`Vittoria Team ${index + 1}`).setStyle(index + 1 === winner ? ButtonStyle.Success : ButtonStyle.Primary))
      : [new ButtonBuilder().setCustomId(`score-accept:${reportId}`).setLabel('Approva vincitore dichiarato').setStyle(ButtonStyle.Success)];
    resultButtons.push(new ButtonBuilder().setCustomId(`score-deny:${reportId}`).setLabel('Rifiuta').setStyle(ButtonStyle.Danger));
    const rows = Array.from({ length: Math.ceil(resultButtons.length / 5) }, (_, index) => new ActionRowBuilder().addComponents(resultButtons.slice(index * 5, index * 5 + 5)));
    await destination.send({ embeds: [new EmbedBuilder().setColor('Yellow').setTitle('Score da verificare')
      .addFields({ name: 'Match', value: `\`${matchId}\`` }, { name: 'Tipo', value: type }, { name: 'Vincitore dichiarato', value: type === 'player' ? `Team ${winner}` : (await client.db.get(winner)).nameoftheclan }, { name: 'Inviato da', value: `<@${message.author.id}>` })
      .setImage(attachment.url).setFooter({ text: `Report ${reportId}` }).setTimestamp()], components: rows });
    return message.reply('✅ Screen inviato: uno Scorer verificherà il risultato.');
  },
};

module.exports.slash = {
  name: 'score', description: 'Invia lo screen della vittoria.',
  options: [
    { name: 'match_id', description: 'ID del match', type: 3, required: true },
    { name: 'winner', description: 'Numero team o nome clan vincitore', type: 3, required: true },
    { name: 'screenshot', description: 'Screen della vittoria', type: 11, required: true },
  ],
  run: async (client, interaction) => {
    const { interactionMessage } = require('../../src/bot/functions/interactionMessage');
    const attachment = interaction.options.getAttachment('screenshot');
    const message = interactionMessage(interaction, null, attachment);
    return module.exports.run(client, message, [interaction.options.getString('match_id'), interaction.options.getString('winner')]);
  },
};
module.exports.slashes = [module.exports.slash];
