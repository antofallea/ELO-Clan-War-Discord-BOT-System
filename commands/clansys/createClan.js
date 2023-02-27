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

          const player = message.mentions.members.first() ||
          message.guild.members.cache.get(args[1]) ||
          message.guild.members.cache.find(r => r.user.username.toLowerCase() === args[1].toLocaleLowerCase()) ||
          message.guild.members.cache.find(ro => ro.displayName.toLowerCase() === args[1].toLocaleLowerCase());

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

          const filter = interaction => interaction.user.id == player.id
          

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

          const collector = player.dmChannel.createMessageComponentCollector({componentType: ComponentType.Button, time: 120 * 1000, filter: filter, max: 1})

          collector.on('collect', async interaction => {
            if(interaction.customId == 'accept-invite') {
              return collector.stop('Accepted')
            } else if(interaction.customId == 'deny-invite') {
              return collector.stop('Refused')
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
                .setDescription(`${message.author} refused the invite for the clan!\n\n`)
                .addFields({ name: 'Name of the clan', value: clanget.value.nameoftheclan, inline: true },
                  { name: 'Elo', value: `${clanget.value.elo}`, inline: true })
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

            if(checkclan.value.coleader.includes(message.author.id)) await client.db.pull(`${checkclan.id}.coleader`, message.author.id)
            if(checkclan.value.mod.includes(message.author.id)) await client.db.pull(`${checkclan.id}.mod`, message.author.id)
            if(checkclan.value.leader == message.author.id) return sendError('message',
            message, 
            "❌ Leader can't leave",
            "You're the leader of the clan so you can't leave.",
            "Red")
            await client.db.pull(`${checkclan.id}.members`, message.author.id)
            channelLogsId.send({content: `Il Player : ${message.member} ha leavvato il clan : ${checkclan.value.nameoftheclan}`})

        }

        break;
        case "promote":{
          if(!args[1]) return sendError('message',
          message,
          '❌ No Arguments',
          "You have to specify a player to promote  → \`${client.prefix}clan promote <playerName>\`",
          'Red')

          const arraydb = await client.db.all()
          const nameOfThePlayer = message.mentions.members.first() ||
            message.guild.members.cache.get(args[1]) ||
            message.guild.members.cache.find(r => r.user.username.toLowerCase() === args[1].toLocaleLowerCase()) ||
            message.guild.members.cache.find(ro => ro.displayName.toLowerCase() === args[1].toLocaleLowerCase());
          if (!nameOfThePlayer) return sendError('message',
            message,
            '❌ Args wrong, Player Not Found',
            `Please specify the tag of the player → \`${client.prefix}clan info <@#PlayerName>\``,
            'Red')

          if (nameOfThePlayer == message.member) return sendError('message',
            message,
            '❌ Cannot promote',
            "You can't promote yourself bruh.",
            'Red')

          const playerClan = arraydb.find(clan => clan.value.members.includes(nameOfThePlayer.id))
          const authorClan = arraydb.find(clan => clan.value.members.includes(message.author.id))

          if (!authorClan) return sendError('message',
            message,
            '❌ Clan not found',
            "You don't have a clan",
            'Red')

          if (!playerClan) return sendError('message',
            message,
            '❌ Clan not found',
            'The player you specified has no clan',
            'Red')

          if (playerClan !== authorClan) return sendError('message',
            message,
            '❌ Args wrong',
            'The player you specified is in another clan.',
            'Red')

          if (playerClan.value.members.includes(nameOfThePlayer.id) && !playerClan.value.mod.includes(nameOfThePlayer.id) && !playerClan.value.coleader.includes(nameOfThePlayer.id) && playerClan.value.leader !== nameOfThePlayer.id) {
            if (playerClan.value.leader !== message.author.id && !playerClan.value.coleader.includes(message.author.id)) return sendError('message',
              message,
              '❌ Cannot promote',
              "You are not a coleader or the leader of the clan",
              'Red')
            await client.db.push(`${playerClan.id}.mod`, nameOfThePlayer.id)
            channelLogsId.send({ content: `Il Player : ${message.member} ha promotato il player <@${nameOfThePlayer.id}> a Mod` })
            return message.channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(client.config.embeds.generalcolor)
                  .setTitle('✅ Promote successfully')
                  .setDescription(`Hai promosso correttamente il player ${nameOfThePlayer} a Mod`)
                  .setAuthor({ name: nameOfThePlayer.user.username, iconURL: nameOfThePlayer.displayAvatarURL() })
              ], content: nameOfThePlayer.toString()
            })
          } else if (playerClan.value.mod.includes(nameOfThePlayer.id)) {
            if (playerClan.value.leader !== message.author.id) return sendError('message',
              message,
              '❌ Cannot promote',
              "You are not the leader of the clan",
              'Red')
            await client.db.pull(`${playerClan.id}.mod`, nameOfThePlayer.id)
            await client.db.push(`${playerClan.id}.coleader`, nameOfThePlayer.id)
            channelLogsId.send({ content: `Il Player : ${message.member} ha promotato il player <@${nameOfThePlayer.id}> a CoLeader` })
            return message.channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor(client.config.embeds.generalcolor)
                  .setTitle('✅ Promote successfully')
                  .setDescription(`Hai promosso correttamente il player ${nameOfThePlayer} a CoLeader`)
                  .setAuthor({ name: nameOfThePlayer.user.username, iconURL: nameOfThePlayer.displayAvatarURL() })
              ], content: nameOfThePlayer.toString()
            })
          } else if (playerClan.value.coleader.includes(nameOfThePlayer.id)) {
            if (playerClan.value.leader !== message.author.id) return sendError('message',
              message,
              '❌ Cannot promote',
              "You are not the leader of the clan",
              'Red')
            const msg = await message.channel.send({
              embeds: [
                new EmbedBuilder()
                  .setColor('Yellow')
                  .setTitle('Warning!')
                  .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                  .setDescription(`Are you sure to transfer the clan to ${nameOfThePlayer}?`)
              ], components: [
                new ActionRowBuilder()
                  .addComponents(
                    new ButtonBuilder()
                      .setCustomId('transfer-accept')
                      .setStyle(ButtonStyle.Success)
                      .setLabel('Accept'),
                    new ButtonBuilder()
                      .setCustomId('transfer-deny')
                      .setStyle(ButtonStyle.Danger)
                      .setLabel('Deny')
                  )
              ]
            })

            const filter = interaction => interaction.user.id == message.author.id

            const collector = msg.createMessageComponentCollector({ filter: filter, time: 10 * 1000, max: 1, componentType: ComponentType.Button })

            collector.on('collect', async (interaction) => {
              interaction.deferUpdate()
              if (interaction.customId == 'transfer-accept') {
                collector.stop('Accepted')
              } else if (interaction.customId == 'transfer-deny') {
                collector.stop('Refused')
              }
            })

            collector.on('end', async (items, reason) => {
              if (!items.size) return msg.edit({
                embeds: [
                  new EmbedBuilder()
                    .setColor('DarkRed')
                    .setTitle('🕙 Time expired')
                    .setDescription('Transfer time is expired')
                    .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                ], components: []
              })

              const array = items.map(item => item)

              if (reason == 'Accepted') {
                await client.db.pull(`${playerClan.id}.coleader`, nameOfThePlayer.id)
                await client.db.push(`${playerClan.id}.coleader`, array[0].user.id)
                await client.db.set(`${playerClan.id}.leader`, nameOfThePlayer.id)

                return msg.edit({
                  embeds: [
                    new EmbedBuilder()
                      .setColor(client.config.embeds.generalcolor)
                      .setTitle('✅ Transfer successfully')
                      .setDescription(`Clan transfered to ${nameOfThePlayer}, Hi new leader!`)
                      .setAuthor({ name: nameOfThePlayer.user.username, iconURL: nameOfThePlayer.user.displayAvatarURL() })
                  ], components: []
                })
              } else if (reason == 'Refused') {
                return msg.edit({
                  embeds: [
                    new EmbedBuilder()
                      .setColor(client.config.embeds.generalcolor)
                      .setTitle('✅ Transfer Canceled')
                      .setDescription(`Clan transfer request has been canceled`)
                      .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL() })
                  ], components: []
                })
              } else return;
            })
          } else if (nameOfThePlayer.id == playerClan.value.leader) return sendError('message',
            message,
            '❌ Cannot promote',
            'The player you specified is the leader of the clan',
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