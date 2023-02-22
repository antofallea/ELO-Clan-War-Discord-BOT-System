const { EmbedBuilder } = require('discord.js')

function sendError(type, message_or_interaction, title, description, color) {
  switch(type) {
      case "interaction":
          message_or_interaction.reply({
              embeds: [
                  new EmbedBuilder()
                  .setTitle(title)
                  .setDescription(description)
                  .setColor(color)
              ],
              ephemeral: true
          })
          break;
      case "message":
          message_or_interaction.channel.send({
              embeds: [
                  new EmbedBuilder()
                  .setTitle(title)
                  .setDescription(description)
                  .setColor(color)
              ],
          })
          break;
  }
}

module.exports = { sendError };