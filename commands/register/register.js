const { sendError } = require('../../src/bot/functions/sendError');
const { profileKey, register } = require('../../src/bot/functions/registration');

const fail = (message, text) => sendError('message', message, 'Registrazione', text, 'Red');
const staff = (client, member, id) => client.config.owners.includes(id) || client.config.developers.includes(id) || Boolean(client.config.role?.staff) && member.roles.cache.has(client.config.role.staff);
const targetMember = (message, value) => message.mentions.members.first() || message.guild.members.cache.get(value) || message.guild.members.cache.find(member => member.user.username.toLowerCase() === value?.toLowerCase() || member.displayName.toLowerCase() === value?.toLowerCase());

module.exports = {
  name: 'register', aliases: ['registrati'], description: 'Registra il tuo nome di gioco una sola volta.', usage: '=register <nome>',
  run: async (client, message, args) => {
    const action = args[0]?.toLowerCase();
    if (action === 'edit') {
      if (!staff(client, message.member, message.author.id)) return fail(message, 'Solo lo staff può modificare un nome registrato.');
      const target = targetMember(message, args[1]); const name = args.slice(2).join(' ');
      if (!target || !name) return fail(message, 'Uso: `=register edit @utente <nuovo nome>`.');
      const result = await register(client, target.id, name, message.author.id, true); if (result.error) return fail(message, result.error); await require('../access/access').grantRegisteredAccess(client, target).catch(() => null); return message.reply(`✅ Nome di ${target} ${result.updated ? 'modificato' : 'registrato'}: **${result.profile.name}**.`);
    }
    const name = args.join(' '); if (!name) return fail(message, 'Uso: `=register <nome>`. Il nome non potrà essere modificato dall’utente.');
    const result = await register(client, message.author.id, name); if (result.error) return fail(message, result.error); await require('../access/access').grantRegisteredAccess(client, message.member).catch(() => null); return message.reply(`✅ Registrazione completata: **${result.profile.name}**.`);
  },
};

module.exports.slash = {
  name: 'register', description: 'Registra il tuo nome di gioco.',
  options: [{ name: 'azione', description: 'Registrati o modifica (staff)', type: 3, required: false, choices: [{ name: 'registrati', value: 'self' }, { name: 'modifica utente', value: 'edit' }] }, { name: 'utente', description: 'Solo staff: utente da modificare', type: 6, required: false }, { name: 'nome', description: 'Nome di gioco', type: 3, required: true }],
  run: async (client, interaction) => {
    const action = interaction.options.getString('azione') || 'self'; const target = interaction.options.getMember('utente'); const name = interaction.options.getString('nome');
    const { interactionMessage } = require('../../src/bot/functions/interactionMessage'); const args = action === 'edit' ? ['edit', target?.id, name].filter(Boolean) : [name].filter(Boolean);
    return module.exports.run(client, interactionMessage(interaction, target), args);
  },
};
module.exports.slashes = [module.exports.slash];
