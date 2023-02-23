const { Events, ChannelType, EmbedBuilder } = require("discord.js");
const { sendError } = require("../../src/bot/functions/sendError");

module.exports = {
  name: Events.InteractionCreate,
  /**
   * 
   * @param {import('discord.js').ButtonInteraction} interaction 
   * @param {import('../../src/app')} client 
   */
  run: async (interaction, client) => {
    if(!interaction.isButton()) return;
    if(interaction.customId == "clan-accept") {
      if(!interaction.member.roles.cache.has(client.config.channelRequestsRoleId)) return sendError('interaction',
      interaction,
      '❌ No permission',
      "You can't do that because you don't belong in the staff",
      'Red')

      const clanget = await client.db.get(`clan_${interaction.message.embeds[0].fields[1].value.replace(' ', '_')}`)
      const leader = interaction.guild.members.cache.get(clanget.leader)

      if(!leader) return sendError('interaction',
      interaction,
      '❌ Leader not found',
      "The leader of the clan was not found, probably left the server.",
      'Red')

      if(!clanget || clanget.status !== 'Creating') return sendError('interaction',
      interaction,
      '❌ Database not found',
      'This clan was not found in the database.',
      'Red')

      if(clanget.vocal || clanget.text) return sendError('interaction',
      interaction,
      '❌ Clan broken',
      'This clan is broken, please report this to developers.',
      'Red')

      const vocalchannel = await interaction.guild.channels.create({
        name: `[${clanget.nameoftheclan}] vocal`,
        type: ChannelType.GuildVoice,
        permissionOverwrites: [
          {
            id: clanget.leader,
            allow: ['Connect', 'ViewChannel', 'MoveMembers', 'Stream', 'ManageMessages', 'Speak', 'SendMessages']
          },
          {
            id: client.config.channelRequestsRoleId,
            allow: ['Connect', 'ViewChannel', 'SendMessages']
          },
          {
            id: interaction.guild.roles.everyone.id,
            deny: ['ViewChannel']
          }
        ],
        parent: client.config.parentChannelcreate,
      })

      const textchannel = await interaction.guild.channels.create({
        name: `${clanget.nameoftheclan}・general`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: clanget.leader,
            allow: ['SendMessages', 'ViewChannel', 'ManageMessages']
          },
          {
            id: client.config.channelRequestsRoleId,
            allow: ['ViewChannel', 'SendMessages']
          },
          {
            id: interaction.guild.roles.everyone.id,
            deny: ['ViewChannel']
          }
        ],
        parent: client.config.parentChannelcreate,
      })

      await client.db.set(`clan_${interaction.message.embeds[0].fields[1].value.replace(' ', '_')}.vocal`, vocalchannel.id)
      await client.db.set(`clan_${interaction.message.embeds[0].fields[1].value.replace(' ', '_')}.text`, textchannel.id)
      await client.db.set(`clan_${interaction.message.embeds[0].fields[1].value.replace(' ', '_')}.status`, 'Created')
      await client.db.set(`clan_${interaction.message.embeds[0].fields[1].value.replace(' ', '_')}.elo`, client.config.eloStart)

      leader.send({embeds: [
        new EmbedBuilder()
        .setColor(client.config.embeds.generalcolor)
        .setTitle('Clan accepted')
        .setDescription(`Your clan request has been accepted by the staff, you can find the vc of your clan here: ${vocalchannel} and the text channel: ${textchannel}`)
      ]})

      interaction.message.edit({embeds: [
        new EmbedBuilder()
        .setColor('Green')
        .setTitle(interaction.message.embeds[0].title)
        .setAuthor({name: interaction.message.embeds[0].author.name, iconURL: interaction.message.embeds[0].author.iconURL})
        .addFields(interaction.message.embeds[0].fields)
        .setFooter({text: `This clan request has been accepted by ${interaction.user.tag}`})
      ], components: []})
    } else if(interaction.customId == 'deny-clan') {
      if(!interaction.member.roles.cache.has(client.config.role.channelRequestsRoleId)) return sendError('interaction',
      interaction,
      '❌ No permission',
      "You can't do that because you don't belong in the staff",
      'Red')

      const clanget = await client.db.get(`clan_${interaction.message.embeds[0].fields[1].value.replace(' ', '_')}`)
      const leader = interaction.guild.members.cache.get(clanget.leader)

      if(!leader) return sendError('interaction',
      interaction,
      '❌ Leader not found',
      "The leader of the clan was not found, probably left the server.",
      'Red')

      if(!clanget || clanget.status !== 'Creating') return sendError('interaction',
      interaction,
      '❌ Database not found',
      'This clan was not found in the database.',
      'Red')

      if(clanget.vocal || clanget.text) return sendError('interaction',
      interaction,
      '❌ Clan broken',
      'This clan is broken, please report this to developers.',
      'Red')

      await client.db.delete(`clan_${interaction.message.embeds[0].fields[1].value.replace(' ', '_')}`)

      leader.send({embeds: [
        new EmbedBuilder()
        .setColor(client.config.embeds.generalcolor)
        .setTitle('Clan refused')
        .setDescription(`Your clan request has been refused by the staff.`)
      ]})

      interaction.message.edit({embeds: [
        new EmbedBuilder()
        .setColor('Red')
        .setTitle(interaction.message.embeds[0].title)
        .setAuthor({name: interaction.message.embeds[0].author.name, iconURL: interaction.message.embeds[0].author.iconURL})
        .addFields(interaction.message.embeds[0].fields)
        .setFooter({text: `This clan request has been refused by ${interaction.user.tag}`})
      ]})
    }
  }
}