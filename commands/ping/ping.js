module.exports = {
  name: 'ping',
  /**
   * 
   * @param {import('../../src/app')} client 
   * @param {import('discord.js').Message} message 
   * @param {Array<string>} args 
   */
  run: (client, message, args) => {
    console.log(client.slashCommands)
    message.channel.send({content: `I'm on ${client.ws.ping}ms`})
  }
}

module.exports.slash = {
  name: 'ping',
  description: "Manda il ping del bot.",
  /**
   * 
   * @param {import('../../src/app')} client 
   * @param {import('discord.js').ChatInputCommandInteraction} interaction 
   */
  run: (client, interaction) => {
    interaction.reply({content: `I'm on ${client.ws.ping}ms`, ephemeral: true})
  }
}