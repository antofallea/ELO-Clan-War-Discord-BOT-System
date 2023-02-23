const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } = require('discord.js')
const { sendError } = require('../../src/bot/functions/sendError')
const sqlite = require('better-sqlite3')

module.exports = {
    name: 'clan',
    /**
     * 
     * @param {import('../../src/app')} client 
     * @param {import('discord.js').Message} message 
     * @param {Array<string>} args 
     */
    run: async (client, message, args) => {
      
      //Id Istance
      const requestchannel = client.channels.cache.get(client.config.channelRequestsId)
      const channelLogsId = client.channels.cache.get(client.config.channelLogsId)

      switch (args[0]) {
        case "create": {
          var nameoftheclan = args[1]
          if(!nameoftheclan) return sendError('message',
          message,
          '❌ Args wrong',
          `Please specify the name of the clan → \`${client.prefix}clan create <name>\``,
          'Red')
          if(args.length > 2) nameoftheclan = args.slice(1).join(' ')
          if(nameoftheclan.match("/^[A-Za-z0-9]*$/")) return sendError('message',
          message,
          '❌ Args wrong',
          "You can't use special characters.",
          'Red')
          if(nameoftheclan.length > 15) return sendError('message',
          message,
          '❌ Args wrong',
          'The name of the clan must be less than or equal to 15 characters in length',
          'Red')
          const clancheck = await client.db.get(`clan_${nameoftheclan}`)
          const arraydb = await client.db.all()
          if(arraydb.find(clan => clan.value.members.includes(message.author.id))) return sendError('message',
          message,
          '❌ You Already Have a Clan',
          'You tryed to create a clan when you are in a clan',
          'Red')
          if(clancheck) return sendError('message',
          message,
          '❌ Clan already exists',
          'The name of the clan you specified is already taken',
          'Red')

          message.channel.send({embeds: [
            new EmbedBuilder()
            .setColor(client.config.embeds.generalcolor)
            .setTitle('Clan request sent')
            .setDescription('Your clan request has been sent successfully')
          ]})
          requestchannel.send({content: `<@&${client.config.channelRequestsRoleId}>`,embeds: [
              new EmbedBuilder()
              .setColor('Yellow')
              .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL()})
              .setTitle('Clan request')
              .addFields(
                {name: 'Utente', value: message.author.toString(), inline: true},
                {name: 'Name of the clan', value: nameoftheclan, inline: true},
              )
            ],components: [
              new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                .setCustomId('clan-accept')
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                .setCustomId('clan-deny')
                .setLabel('Deny')
                .setStyle(ButtonStyle.Danger), 
              )  
            ]})
          
          message.channel.send({content: nameoftheclan.replace(' ', '_')})

          await client.db.set(`clan_${nameoftheclan.replace(' ', '_')}`, {
            leader: message.author.id,
            nameoftheclan: nameoftheclan,
            mod: [],
            coleader: [],
            members: [message.author.id],
            status: 'Creating'
          })
          channelLogsId.send({content: `Il Player : ${message.member} ha creato il clan ${nameoftheclan}`})
        }



        break;
        case "delete": {
            const arraydb = await (await client.db.all()).filter(clan => clan.id.startsWith('clan_'))
            const clancheck = arraydb.find(clan => clan.value.leader == message.author.id)
            if(!clancheck) return sendError('message',
            message,
            '❌ Clan not found',
            "You aren't the leader of any clan.",
            'Red')
            message.channel.send({embeds: [
              new EmbedBuilder()
              .setColor(client.config.embeds.generalcolor)
              .setTitle('✅ Clan deleted')
              .setDescription('Your clan has been deleted successfully')
              .setAuthor({name: message.author.username, iconURL: message.author.displayAvatarURL()})
            ]})
            await client.db.delete(clancheck.id)
            channelLogsId.send({content: `Il Player : ${message.member} ha eliminato il clan ${clancheck.value.nameoftheclan}`})
        }



        break;
        case "invite": {
          if(!args[1]) return sendError('message',
          message,
          '❌ Args missing',
          'Please specify the user who you wants to invite',
          'Red')
          console.log(args[1])
          const player = message.mentions.members.first() ||
          message.guild.members.cache.get(args[1]) ||
          message.guild.members.cache.find(r => r.user.username.toLowerCase() === args[1].toLocaleLowerCase()) ||
          message.guild.members.cache.find(ro => ro.displayName.toLowerCase() === args[1].toLocaleLowerCase());

          console.log(player)
          if(!player) return sendError('message',
          message,
          '❌ Args wrong',
          `Please specify the name of the player → \`${client.prefix}clan invite <PlayerName>\``,
          'Red')

          //Leader or Mod Check
          const arraydb = await client.db.all()
          const checkclan = arraydb.find(clan => clan.value.members.includes(player.id))
          if(checkclan) return sendError('message',
          message,
          '❌ Cannot invite the player',
          'The player you specified already has a clan.',  
          'Red')
          const clanget = arraydb.find(clan => clan.value.leader == message.author.id || clan.value.mod.includes(message.author.id))
          if(!clanget) return sendError('message',
          message,
          '❌ You dont have the perms for do that',
          'You tryed to invite a player when you dont have the perms to do that',
          'Red')

          if(clanget.value.status == 'Creating') return sendError('message',
          message,
          "❌ Cannot invite players",
          "The request of the clan was not accepted.",
          "Red")
          
          if(clanget.value.members.length >= 10 || arraydb.find(clan => clan.value.members.includes(player.id))) return sendError('message',
          message,
          '❌ Cannot invite user',
          "You can't invite this user because the clan has 10 players or this user is already in the clan.",
          'Red') 

          const filter = interaction => {
            interaction.deferUpdate()
            return interaction.user.id
          }

          const msg = await player.send({embeds: [
            new EmbedBuilder()
            .setColor(client.config.embeds.generalcolor)
            .setAuthor({name: 'Ranked Clan Invitation', iconURL: 'https://i.imgur.com/UiLkmX6.png'})
            .setDescription(`${message.author} invited you to his clan. You have **120 Seconds** to accept!\n\n`)
            .addFields({name: 'Name of the clan', value: clanget.value.nameoftheclan, inline: true},
            {name: 'Elo', value: `${clanget.value.elo}`, inline: true})
          ], components: [
            new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
              .setCustomId('accept-invite')
              .setLabel('Accept')
              .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
              .setCustomId('deny-invite')
              .setLabel('Deny')
              .setStyle(ButtonStyle.Danger)
            )
          ]})

          const collector = player.dmChannel.createMessageComponentCollector({componentType: ComponentType.Button, time: 120 * 1000, filter: filter})

          collector.on('collect', async interaction => {
            try {
            if(interaction.customId == 'accept-clan-invite') {
              collector.stop('Accepted')
            } else if(interaction.customId == 'deny-clan-invite') {
              collector.stop('Refused')
            }
            } catch(error) {
              if(error.code == DiscordjsErrorCodes.InteractionCollectorError) {
                return interaction.message.edit({embeds: [
                  new EmbedBuilder()
                  .setColor('DarkRed')
                  .setAuthor({name: 'Ranked Clan Invitation', iconURL: 'https://i.imgur.com/UiLkmX6.png'})
                  .setDescription(`${message.author} invitation cancelled due to inactivity!\n\n`)
                  .addFields({ name: 'Name of the clan', value: clanget.value.nameoftheclan, inline: true },
                    { name: 'Elo', value: `${clanget.value.elo}`, inline: true })
                ], components: []})
              } else {
                console.error(error)
                return interaction.reply({content: `An internal error occured`, ephemeral: true})
              }
            }
          })

          collector.on('end', async (items, reason) => {
            if(!items.size) return msg.edit({embeds: [
              new EmbedBuilder()
              .setColor('DarkRed')
              .setAuthor({name: 'Ranked Clan Invitation', iconURL: 'https://i.imgur.com/UiLkmX6.png'})
              .setDescription(`${message.author} invitation time expired!\n\n`)
              .addFields({ name: 'Name of the clan', value: clanget.value.nameoftheclan, inline: true },
                { name: 'Elo', value: `${clanget.value.elo}`, inline: true })
            ], components: []})
            var collected = items.map(interaction => interaction)
            if(reason == 'Accepted') {
              await client.db.push(`${clanget.id}.members`, collected[0].user.id)

              collected[0].message.edit({embeds: [
                new EmbedBuilder()
                .setColor('Green')
                .setAuthor({name: 'Ranked Clan Invitation', iconURL: 'https://i.imgur.com/UiLkmX6.png'})
                .setDescription(`${message.author} joined the clan!\n\n`)
                .addFields({ name: 'Name of the clan', value: clanget.value.nameoftheclan, inline: true },
                  { name: 'Elo', value: `${clanget.value.elo}`, inline: true })
              ], components: []})
            } else if(reason == 'Refused') {
              collected[0].message.edit({embeds: [
                new EmbedBuilder()
                .setColor('DarkRed')
                .setAuthor({name: 'Ranked Clan Invitation', iconURL: 'https://i.imgur.com/UiLkmX6.png'})
                .setDescription(`${message.author} refused the invation for the clan!\n\n`)
                .addFields({ name: 'Name of the clan', value: clanget.value.nameoftheclan, inline: true },
                  { name: 'Elo', value: clanget.value.elo, inline: true })
              ], components: []})
            }
          })

          channelLogsId.send({content: `Il Player : ${message.member} ha invitato il player : ${player} nel suo clan`})
      }



        break;
        case "kick": {
            if(!args[1]) return
            const nameOfThePlayer = message.mentions.members.first() ||
            message.guild.members.cache.get(args[1]) ||
            message.guild.members.cache.find(r => r.user.username.toLowerCase() === args[1].toLocaleLowerCase()) ||
            message.guild.members.cache.find(ro => ro.displayName.toLowerCase() === args[1].toLocaleLowerCase());
            if(!nameOfThePlayer) return sendError('message',
            message,
            '❌ Args wrong',
            `Please specify the name of the player → \`${client.prefix}clan invite <PlayerName>\``,
            'Red')
            
            //Leader or Mod Check
            const arraydb = await client.db.all()
            const clanget = arraydb.find(clan => clan.value.leader == message.author.id || clan.value.mod.includes(message.author.id) || clan.value.coleader.includes(message.author.id))
            const playerIndex = arraydb.find(clan => clan.value.members.includes(nameOfThePlayer.id))
            
            if(!clanget) return sendError('message',
            message,
            '❌ You dont have the perms for do that',
            'You tryed to invite a player when you dont have the perms to do that',
            'Red')
            if(!playerIndex) return sendError('message',
            message,
            '❌ The member is not in your clan',
            'You tryed to kick a player that is not in your clan',
            'Red')

            await client.db.pull(`${clanget.id}.members`, nameOfThePlayer.id)

            channelLogsId.send({content: `Il Player : ${message.member} ha kickato il player ${nameOfThePlayer} dal suo clan`})
        }



        break;
        case "mod": {
            if(!args[1]) return
            const nameOfThePlayer = message.mentions.members.first() ||
            message.guild.members.cache.get(args[1]) ||
            message.guild.members.cache.find(r => r.user.username.toLowerCase() === args[1].toLocaleLowerCase()) ||
            message.guild.members.cache.find(ro => ro.displayName.toLowerCase() === args[1].toLocaleLowerCase());
            if(!nameOfThePlayer) return sendError('message',
            message,
            '❌ Args wrong',
            `Please specify the name of the player → \`${client.prefix}clan mod <PlayerName>\``,
            'Red')
            
            //Leader Check
            const arraydb = await client.db.all()
            const clanoftheplayer = arraydb.find(clan => clan.value.members.includes(message.author.id))
            if(!clanoftheplayer) return sendError('message',
            message,
            "❌ Clan not found",
            "You don't have a clan",
            'Red')
            if(clanoftheplayer.value.leader !== message.author.id) return sendError('message',
            message,
            "❌ You don't have the perms for do that",
            "You tryed to invite a player when you don't have the perms to do that",
            'Red')
            if(!clanoftheplayer.value.members.includes(nameOfThePlayer.id)) return sendError('message',
            message,
            '❌ The member is not in your clan',
            'You tryed to promote a player that is not in your clan',
            'Red')
                
            await client.db.push(`${clanoftheplayer.id}.mod`, nameOfThePlayer.id)
            channelLogsId.send({content: `Il Player : ${message.member} ha messo mod del suo clan il player : ${nameOfThePlayer}`})

        }
        break;
        case "info":{
            if(args[1]){
              if(args[1].length>0){
                const arraydb = await client.db.all()
                const nameOfThePlayer = message.mentions.members.first() ||
                message.guild.members.cache.get(args[1]) ||
                message.guild.members.cache.find(r => r.user.username.toLowerCase() === args[1].toLocaleLowerCase()) ||
                message.guild.members.cache.find(ro => ro.displayName.toLowerCase() === args[1].toLocaleLowerCase());
                if(!nameOfThePlayer) return sendError('message',
                message,
                '❌ Args wrong',
                `Please specify the tag of the player → \`${client.prefix}clan info <@#PlayerName>\``,
                'Red')

                const playerClan = arraydb.find(clan => clan.value.members.includes(nameOfThePlayer.id))

                if(!playerClan) return sendError('message',
                message,
                "❌ Clan not found",
                "This Player Has No Clan",
                'Red')
                else {
                  
                  const clanToFoundRow = await client.db.get(`${playerClan.id}`)
                  const ids = clanToFoundRow.members
                  const mentionMessage = ids.map(ids => `<@${ids}>`);
                  return message.reply("Clan Name : " + clanToFoundRow.nameoftheclan + "\nMembers : " + mentionMessage.join(' '))
                }

              }
            }
            else{
              const arraydb = await client.db.all()
              const clanToFound = arraydb.find(clan => clan.value.members.includes(message.author.id)) 
              if(!clanToFound) return sendError('message',
              message,
              "❌ No Clan",
              "You don't have a clan",
              'Red')
              else {
                const clanToFoundRow = await client.db.get(`${clanToFound.id}`)
                const allmembers = clanToFoundRow.members
                let mods = clanToFoundRow.mod
                let coleaders = clanToFoundRow.coleader
                let leader = clanToFoundRow.leader
                let filtermembers = allmembers.filter(member => !mods.includes(member) && !coleaders.includes(member) && leader !== member)
                return message.channel.send({embeds: [
                  new EmbedBuilder()
                  .setColor(client.config.embeds.generalcolor)
                  .setTitle(`Info of ${clanToFoundRow.nameoftheclan}`)
                  .addFields({name: 'Name', value: `${clanToFoundRow.nameoftheclan}`, inline: true},
                  {name: 'Elo', value: `${clanToFoundRow.elo}`, inline: true},
                  {name: 'Leader', value: `<@${leader}>`, inline: true},
                  {name: 'CoLeaders', value: `${coleaders.map(coleader => `<@${coleader}>`).join(' ') || "Nothing"}`, inline: true},
                  {name: 'Mods', value: `${mods.map(mod => `<@${mod}>`).join(' ') || "Nothing"}`, inline: true},
                  {name: 'Members', value: `${filtermembers.map(member => `<@${member}>`).join(' ') || "Nothing"}`, inline: true})
                ]})
              }
            }
        }
        break;
        case "cw":{
          const arraydb = await client.db.all()
          const playerClan = arraydb.get(clan => clan.value.members.includes(message.author.id))
          const checkclan = arraydb.find(clan => clan.value.nameoftheclan === args[1])
          if(playerClan === args[1]) return sendError('message',
          message,
          "❌ You Are In This Clan",
          "You can't send a cw to your same clan",
          'Red')
          if(!checkclan) return sendError('message',
          message,
          "❌ Clan don't exists",
          "The clan you specified don't exists.",
          'Red')
          else return message.reply("Cw Sent To : " + args[1])

        }
        break;
        case "leave":{
            
            //Leader or Mod Check
            const arraydb = await client.db.all()
            const checkclan = arraydb.find(clan => clan.value.members.includes(message.author.id))
            if(!checkclan) return sendError('message',
            message,
            "❌ You don't have a clan",
            "You are trying to leave from a clan that you are not in",
            'Red')
            const clanget = arraydb.find(clan => clan.value.leader == message.author.id)
            if(clanget) return sendError('message',
            message,
            "❌ You can't leave the clan",
            "You can't leave a clan when you are a leader , you have to delete it!",
            'Red')

            await client.db.pull(`${checkclan.id}.members`, message.author.id)
            channelLogsId.send({content: `Il Player : ${message.member} ha leavvato il clan : ${checkclan.value.nameoftheclan}`})

        }

        case "promote":{
          if(args[1]){
            if(args[1].length>0){
                const arraydb = await client.db.all()
                const nameOfThePlayer = message.mentions.members.first() ||
                message.guild.members.cache.get(args[1]) ||
                message.guild.members.cache.find(r => r.user.username.toLowerCase() === args[1].toLocaleLowerCase()) ||
                message.guild.members.cache.find(ro => ro.displayName.toLowerCase() === args[1].toLocaleLowerCase());
                if(!nameOfThePlayer) return sendError('message',
                message,
                '❌ Args wrong, Player Not Found',
                `Please specify the tag of the player → \`${client.prefix}clan info <@#PlayerName>\``,
                'Red')
                             
                const playerClan = arraydb.find(clan => clan.value.members.includes(nameOfThePlayer.id))
                const authorClan = arraydb.find(clan => clan.value.members.includes(message.author.id))
                const getPlayerClanRow = await client.db.get(`${playerClan.id}`)
                const getAuthorClanRow = await client.db.get(`${authorClan.id}`)  
                
                if(getPlayerClanRow == getAuthorClanRow){
                  const memberCheck = await client.db.get(`${getPlayerClanRow.members}`)
                  const modCheck = await client.db.get(`${getPlayerClanRow.mod}`)
                  const coleaderCheck = await client.db.get(`${getPlayerClanRow.coleader}`)
                  const leaderCheck = await client.db.get(`${getPlayerClanRow.leader}`)

                  if(modCheck||coleaderCheck||leaderCheck){
                    if(memberCheck.includes[nameOfThePlayer.id]){
                      if(coleaderCheck.includes[message.author.id]||leaderCheck.includes[message.author.id]){
                        await client.db.pull(`${playerClan.id}.members`, nameOfThePlayer.id)
                        await client.db.push(`${checkclan.id}.mods`, nameOfThePlayer.id)
                        channelLogsId.send({content: `Il Player : ${message.member} ha promotato il player <@&${nameOfThePlayer.id}> a Mod`})
                      }
                    }
                    else if(modCheck.includes[nameOfThePlayer.id]){
                      if(leaderCheck.includes[message.author.id]){
                        await client.db.pull(`${checkclan.id}.mods`, nameOfThePlayer.id)
                        await client.db.push(`${checkclan.id}.coleader`, nameOfThePlayer.id)
                        channelLogsId.send({content: `Il Player : ${message.member} ha promotato il player <@&${nameOfThePlayer.id}> a Coleader`})
                      }
                    }
                  }
                  else return sendError('message',
                  message,
                  '❌ No Permission',
                  "You don't have permission clan  → \`${client.prefix}clan create <ClanName>\`",
                  'Red')

                }
                else return sendError('message',
                message,
                '❌ No Clan',
                "You don't have a clan  → \`${client.prefix}clan create <ClanName>\`",
                'Red')
            }
          }
          else return sendError('message',
                message,
                '❌ No Arguments',
                "You have to specify a player to promot  → \`${client.prefix}clan promote <playerName>\`",
                'Red')
        }
        
        break;
        default: {
          return sendError('message',
            message,
            '❌ No Arguments',
            "You didn't insert any arguments",
            'Red')
        }
      }

    }
  }
  
module.exports.slash = {
  name: 'clan',
  description: "Manda il ping del bot.",
  /**
   * 
   * @param {import('../../src/app')} client 
   * @param {import('discord.js').ChatInputCommandInteraction} interaction 
   */
  run: (client, interaction) => {
    interaction.reply({ content: `I'm on ${client.ws.ping}ms`, ephemeral: true })
  }
}