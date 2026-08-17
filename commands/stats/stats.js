const { EmbedBuilder } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');
const { config, rankFor, playerStats } = require('../../src/bot/functions/elo');

const fail = (message, text) => sendError('message', message, 'Statistiche', text, 'Red');
const staff = (client, member, id) => client.config.owners.includes(id) || client.config.developers.includes(id) || Boolean(client.config.role?.staff) && member.roles.cache.has(client.config.role.staff);
const targetMember = (message, arg) => message.mentions.members.first() || message.guild.members.cache.get(arg) || message.guild.members.cache.find(member => member.user.username.toLowerCase() === arg?.toLowerCase() || member.displayName.toLowerCase() === arg?.toLowerCase());

module.exports = {
  name: 'stats', aliases: ['leaderboard', 'lb', 'elo'], description: 'Statistiche ELO e leaderboard.', usage: '=stats [@utente]',
  run: async (client, message, args, invokedAs) => {
    const action = invokedAs || 'stats';
    if (action === 'leaderboard' || action === 'lb') {
      const limit = Math.min(25, Math.max(3, Number(args[0]) || 10));
      const entries = (await client.db.all()).filter(entry => entry.id.startsWith('player_stats_')).sort((a, b) => b.value.elo - a.value.elo).slice(0, limit);
      const eloConfig = await config(client);
      const body = entries.length ? entries.map((entry, index) => `${index + 1}. <@${entry.id.slice(13)}> — **${entry.value.elo} ELO** (${rankFor(eloConfig, entry.value.elo).name})`).join('\n') : 'Nessuna partita classificata ancora.';
      return message.channel.send({ embeds: [new EmbedBuilder().setColor('Gold').setTitle('🏆 Leaderboard ELO giocatori').setDescription(body)] });
    }
    if (action === 'elo') {
      const sub = args.shift()?.toLowerCase() || 'ranks'; const eloConfig = await config(client);
      if (sub === 'ranks') return message.channel.send({ embeds: [new EmbedBuilder().setColor('Blue').setTitle('Rank ELO').setDescription(eloConfig.ranks.sort((a, b) => a.minElo - b.minElo).map(rank => `**${rank.name}** — da ${rank.minElo} ELO · +${rank.win} win / -${rank.loss} lose`).join('\n'))] });
      if (!staff(client, message.member, message.author.id)) return fail(message, 'Solo lo staff può configurare l’ELO.');
      if (sub === 'rank' && args.shift()?.toLowerCase() === 'add') {
        const [name, minElo, win, loss] = args; const values = [Number(minElo), Number(win), Number(loss)];
        if (!name || values.some(value => !Number.isInteger(value) || value < 0) || eloConfig.ranks.some(rank => rank.name.toLowerCase() === name.toLowerCase())) return fail(message, 'Uso: `=elo rank add <nome> <eloMinimo> <win> <loss>`.');
        eloConfig.ranks.push({ name: name.slice(0, 30), minElo: values[0], win: values[1], loss: values[2] }); eloConfig.ranks.sort((a, b) => a.minElo - b.minElo); await client.db.set('elo_config', eloConfig); return message.reply(`Rank **${name}** aggiunto.`);
      }
      if (sub === 'rank' && args.shift()?.toLowerCase() === 'remove') {
        const name = args.join(' ').toLowerCase(); if (eloConfig.ranks.length <= 1 || !name) return fail(message, 'Non puoi rimuovere l’ultimo rank.');
        const before = eloConfig.ranks.length; eloConfig.ranks = eloConfig.ranks.filter(rank => rank.name.toLowerCase() !== name); if (before === eloConfig.ranks.length) return fail(message, 'Rank non trovato.'); await client.db.set('elo_config', eloConfig); return message.reply('Rank rimosso.');
      }
      if (sub === 'streak') {
        const values = args.map(Number); if (values.length !== 6 || values.some(value => !Number.isInteger(value) || value < 0)) return fail(message, 'Uso: `=elo streak <winSoglia> <winBonus> <winMax> <lossSoglia> <lossPenalità> <lossMax>`.');
        eloConfig.winStreak = { threshold: values[0], bonusPerWin: values[1], maxBonus: values[2] }; eloConfig.lossStreak = { threshold: values[3], penaltyPerLoss: values[4], maxPenalty: values[5] }; await client.db.set('elo_config', eloConfig); return message.reply('Configurazione streak aggiornata.');
      }
      return fail(message, 'Usa `=elo ranks`, `=elo rank add`, `=elo rank remove` o `=elo streak`.');
    }
    const target = targetMember(message, args[0]) || message.member; const stats = await playerStats(client, target.id); const rank = rankFor(await config(client), stats.elo);
    return message.channel.send({ embeds: [new EmbedBuilder().setColor('Aqua').setTitle(`Statistiche di ${target.user.username}`).addFields(
      { name: 'ELO / Rank', value: `**${stats.elo}** — ${rank.name}`, inline: true }, { name: 'Win / Lose', value: `${stats.wins} / ${stats.losses}`, inline: true }, { name: 'Winrate', value: `${stats.wins + stats.losses ? Math.round(stats.wins / (stats.wins + stats.losses) * 100) : 0}%`, inline: true }, { name: 'Streak', value: `W${stats.winStreak} · L${stats.lossStreak} · Best W${stats.bestWinStreak}`, inline: false })] });
  },
};

const statsSlash = {
  name: 'stats', description: 'Mostra statistiche ELO.', options: [{ name: 'utente', description: 'Utente (opzionale)', type: 6, required: false }],
  run: async (client, interaction) => { const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const target = interaction.options.getMember('utente'); return module.exports.run(client, interactionMessage(interaction, target), target ? [target.id] : [], 'stats'); },
};
const leaderboardSlash = {
  name: 'leaderboard', description: 'Classifica giocatori per ELO.', options: [{ name: 'limite', description: 'Da 3 a 25', type: 4, required: false }],
  run: async (client, interaction) => { const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const limit = interaction.options.getInteger('limite'); return module.exports.run(client, interactionMessage(interaction), limit ? [String(limit)] : [], 'leaderboard'); },
};
const eloSlash = {
  name: 'elo', description: 'Consulta o configura rank e streak ELO.',
  options: [{ name: 'azione', description: 'Azione ELO', type: 3, required: true, choices: [{ name: 'ranks', value: 'ranks' }, { name: 'aggiungi rank', value: 'rank_add' }, { name: 'rimuovi rank', value: 'rank_remove' }, { name: 'streak', value: 'streak' }] }, { name: 'testo', description: 'Parametri dell’azione', type: 3, required: false }],
  run: async (client, interaction) => { const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const action = interaction.options.getString('azione'); const text = interaction.options.getString('testo'); const args = action === 'rank_add' ? ['rank', 'add'] : action === 'rank_remove' ? ['rank', 'remove'] : [action]; if (text) args.push(...text.split(/\s+/)); return module.exports.run(client, interactionMessage(interaction), args, 'elo'); },
};
module.exports.slash = statsSlash;
module.exports.slashes = [statsSlash, leaderboardSlash, eloSlash, { ...leaderboardSlash, name: 'lb', description: 'Classifica ELO giocatori.' }];
