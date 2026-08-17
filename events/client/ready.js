const { Events } = require('discord.js')
const chalk = require('chalk')

module.exports = {
  name: Events.ClientReady,
  once: true,
  /**
   * 
   * @param {import('../../src/app')} client 
   */
  run: async (client) => {
    console.log(chalk.white(`
    ██████╗ ██████╗ ██╗    ██╗ ██████╗███╗   ███╗
    ██╔══██╗██╔══██╗██║    ██║██╔════╝████╗ ████║
    ██████╔╝██████╔╝██║ █╗ ██║██║     ██╔████╔██║
    ██╔══██╗██╔══██╗██║███╗██║██║     ██║╚██╔╝██║
    ██║  ██║██████╔╝╚███╔███╔╝╚██████╗██║ ╚═╝ ██║
    ╚═╝  ╚═╝╚═════╝  ╚══╝╚══╝  ╚═════╝╚═╝     ╚═╝`))
    console.log(chalk.hex('#00AAAA')(`
     The bot is online and ready to manage RBWCM.`))

    // Remove temporary tournament rooms that expired while the bot was offline.
    try {
      await require('../../commands/moderation/staff').cleanupTemporaryTournaments(client);
    } catch (error) {
      console.error('Temporary tournament cleanup failed:', error);
    }

    client.guilds.cache.forEach(guild => {
        let array = [];
        client.slashCommands.forEach(cmd => {
            array.push(cmd)
        });
        guild.commands.set(array).then(collector => {
            collector.map(command => {
                const interactionCommand = guild.commands.cache.get(command.id);
                array.map(cmd => {
                    if(cmd.permissions && command.name == cmd.name) interactionCommand.setDefaultMemberPermissions(cmd.permissions)
                })
            })
        })
    });
  }
}
