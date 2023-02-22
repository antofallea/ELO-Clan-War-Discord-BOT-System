const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js')
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
            channelLogsId.send({content: `Il Player : ${message.member} ha eliminato il clan ${nameoftheclan}`})
        }



        break;
        case "invite": {
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
            const checkclan = arraydb.find(clan => clan.value.members.includes(nameOfThePlayer))
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

            // Se son più di 10 già fa il return si si
            
            if(clanget.value.members.length >= 10 || arraydb.find(clan => clan.value.members.includes(nameOfThePlayer.id))) return sendError('message',
            message,
            '❌ Cannot invite user',
            "You can't invite this user because the clan has 10 players or this user is already in the clan.",
            'Red') 
            // Vabbò chiudo visual studio code
            await client.db.push(`${clanget.id}.members`, nameOfThePlayer.id)
            channelLogsId.send({content: `Il Player : ${message.member} ha invitato il player : ${nameOfThePlayer} nel suo clan`})
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
            if(!args[0]) return 

            if(args[1]>0){
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

              const playerClan = arraydb.find(clan => clan.value.members.includes(nameOfThePlayer.id))

              if(!playerClan) return sendError('message',
              message,
              "❌ Clan not found",
              "This Player Has No Clan",
              'Red')
              else return message.reply("") //Manda tutte le info del clan

            }
            else{
              const arraydb = await client.db.all()
              const clanToFound = arraydb.find(clan => clan.value.members.includes(message.author.id)) 
            
              
              if(!clanToFound) return sendError('message',
              message,
              "❌ No Clan",
              "You don't have a clan",
              'Red')
              else return message.reply("") //Manda tutte le info del clan
            }
        }
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