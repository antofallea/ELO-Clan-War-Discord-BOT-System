const { EmbedBuilder } = require('discord.js');
const { sendError } = require('../../src/bot/functions/sendError');

module.exports = {
  name: 'messageCreate',
  nick: 'Prefix',
  /**
   * 
   * @param {import('discord.js').Message} message 
   * @param {import('../../src/app')} client 
   */
  run: async (message, client) => {
      let prefix = client.config.default_prefix  
    const prefixMention = new RegExp(`^<@!?${client.user.id}> `);
    prefix = message.content.match(prefixMention)
      ? message.content.match(prefixMention)[0]
      : prefix;

      if(message.content.indexOf(prefix) !== 0) return;
      const args = message.content.slice(prefix.length).trim().split(/ +/g);
      const command = args.shift().toLowerCase();
      const cmd = client.commands.get(command) || client.commands.find(c => c.aliases && c.aliases.includes(command));

      if(!cmd) return;

      if(
          cmd.permissions &&
          cmd.permissions.member &&
          cmd.permissions.member.length &&
          !message.channel.permissionsFor(message.member).has(cmd.permissions.member)
      ) return sendError(
          'message',
          message,
          '403 Missing Permission',
          `You are missing the permissions of the current command, ${cmd.permissions.member.join(', ')}`,
          'Red'
      );
      if(cmd.onlystaff) {
        if(!message.member.roles.cache.has(client.config.role.staff)) {
          message.delete().catch(() => null)
          return sendError('message',
          message,
          '❌ No permission',
          "You don't have permission because you don't belong to the staff.",
          'Red')
        }
      }
      if(cmd.onlyadministrator) {
        if(!message.member.permissions.has('Administrator')) {
          message.delete().catch(() => null)
          return message.channel.send({embeds: [
            new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ No permission')
            .setDescription("You don't have permission because you don't belong to the HeadStaff.")
            .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL({dynamic: true})})
          ]})
        }
      }
      if(cmd.onlydevelopers) {
        const concatarrays = client.config.owners.concat(client.config.developers)
        if(!concatarrays.includes(message.author.id)) {
          message.delete().catch(() => null)
          return message.channel.send({embeds: [
            new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ No permission')
            .setDescription("You don't have permission because you don't belong to the Developers team.")
            .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL({dynamic: true})})
          ]})
        }
      }
      
      if(cmd.maintenance) {
        const concatarrays = client.config.owners.concat(client.config.developers)
        if(!concatarrays.includes(message.author.id)) {
          return sendError(
            'message',
            message,
            '405 Command under maintenance',
            `This command is under maintenance and only developers can use it.`,
            'Red'
          )
        }
      }
      if(cmd.onlyroles) {
        if(!message.member.roles.cache.some(role => cmd.onlyroles.includes(role.name))) return message.channel.send({embeds: [
          new EmbedBuilder()
          .setColor('Red')
          .setTitle('❌ No permission')
          .setDescription("You don't have permission to do that.")
          .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL({dynamic: true})})
        ]})
      }
      if(command.cooldown) {
        const cooldownCheck = await client.db.get(`cooldown_${interaction.user.id}_${command.name}`)
        if(cooldownCheck && cooldownCheck.command == command.name) {
          const expireDate = moment(cooldownCheck.dateExpire, 'YYYY-MM-DD HH:mm:ss')
          if(expireDate.isBefore()) {
            await client.db.delete(`cooldown_${interaction.user.id}_${command.name}`) 
          } else {
            return sendError('interaction',
            interaction,
            '❌ Cooldown command',
            `You're on cooldown, wait ${cooldownCheck.time} to run this command again.`,
            'Red')
          } 
        } else {
          await client.db.set(`cooldown_${interaction.user.id}_${command.name}`, {
            cooldown: true,
            time: command.cooldown,
            command: command.name,
            dateExpire: moment(moment()).add(parseInt(command.cooldown.slice(0, -1), 10), command.cooldown.slice(-1)).format('YYYY-MM-DD HH:mm:ss'),
          })
          setTimeout(async () => {
            await client.db.delete(`cooldown_${interaction.user.id}_${command.name}`)
          }, ms(command.cooldown));
        }
      }
      if(
          cmd.permissions &&
          cmd.permissions.bot &&
          cmd.permissions.bot.length &&
          !message.channel.permissionsFor(message.guild.me).has(cmd.permissions.bot)
      ) return sendError(
          'message',
          message,
          '403 Bot Missing Permission',
          `You are missing the permissions of the current command, ${cmd.permissions.bot.join(', ')}`,
          'Red'
      );
      
      cmd.run(client, message, args)

  },
};
