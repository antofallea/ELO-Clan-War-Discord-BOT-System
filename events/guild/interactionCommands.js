const { sendError } = require('../../src/bot/functions/sendError');
const ms = require('ms')
const moment = require('moment');

module.exports = {
  name: 'interactionCreate',
  /**
   * 
   * @param {import('discord.js').CommandInteraction} interaction 
   * @param {import('../../src/app')} client 
   */
  run: async (interaction, client) => {
      if(interaction.isChatInputCommand()) {
          const command = client.slashCommands.get(interaction.commandName);

          if(!command)
          return sendError(
              'interaction',
              interaction,
              '❌ Command not found',
              'The command was not found or has been deleted.',
              'Red'
          );

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

          if(command.onlydevelopers) {
            const concatarrays = client.config.owners.concat(client.config.developers)
            if(!concatarrays.includes(interaction.user.id)) {
              message.delete().catch(() => null)
              return interaction.reply({embeds: [
                new EmbedBuilder()
                .setColor('Red')
                .setTitle('❌ No permission')
                .setDescription("You don't have permission because you don't belong to the Developers team.")
                .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL({dynamic: true})})
              ], ephemeral: true})
            }
          }

          if(command.slash?.permissions && !interaction.member.permissions.has(command.slash?.permissions)) return sendError('interaction',
          interaction,
          '❌ Missing permissions',
          `You don't have permission \`${command.permissions}\` to do that`,
          'Red')

          if(!command.dontmindpermissions && command.slash?.permissions && !interaction.guild.members.me.permissions.has(command.slash?.permissions)) return sendError(
              'interaction',
              interaction,
              'Bot missing permissions',
              `I don't have the permission \`${command.slash?.permissions}\` to do this command.`,
              'Red'
          );

          command.run(client, interaction)
      }
  }
}