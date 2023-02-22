const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const { inspect } = require('util');

/**
 * 
 * @param {import('../../bot/discordClient')} client 
 */
function loadHandlers(client) {
  fs.readdirSync('./commands/').forEach(directory => {
    const files = fs.readdirSync(`./commands/${directory}`).filter(file => file.endsWith('.js'))

    if(!files || files?.length <= 0) return console.log(chalk.red(`${directory} commands = 0`))

    files.forEach((file) => {
      let command = require(`../../../commands/${directory}/${file}`)
      if(!command) return console.log(chalk.red(`❌ /commands/${directory}/${file} non è stato caricato`))
      if(!command?.name || !command.slash?.name) return console.log(chalk.red(`❌ /commands/${directory}/${file} non è stato caricato perchè non hai specificato il nome.`))
      const missing = [];
      if(!command.description || !command.slash.description) missing.push('descrizione')
      if(!command.usage || !command.slash.usage) missing.push('usage')
      if(missing.length) console.log(chalk.yellow(`(/commands/${directory}/${file}) è consigliato un: ${missing.join(' & ')}`))

      client.commands.set(command.name, command)
      if(command.slash && command.slash?.name && command.slash?.description) client.slashCommands.set(command.slash?.name, command.slash)
    })
  })
  // anticrash

  const errorchannel = new WebhookClient({url: "https://canary.discord.com/api/webhooks/1076862941351137300/8IPKREA4ukRhPoZUDDDruG0By6BOqoGNmKnQt7K3aapN_IHmkI0ECugAnAy4fs7fMLuU"})

  client.on('error', (err) => {
    console.log(err)
    return errorchannel.send({embeds: [
      new EmbedBuilder()
      .setColor('Red')
      .setTitle('An internal error occured')
      .setURL("https://discordjs.guide/popular-topics/errors.html#api-errors")
      .setDescription(`\`\`\`${inspect(err, { depth: 0 }).slice(0, 1000)}\`\`\``)
      .setTimestamp()
    ]})
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.log(reason, "\n", promise)
    return errorchannel.send({embeds: [
      new EmbedBuilder()
      .setColor('Red')
      .setTitle('Unhandled Rejection/Catch')
      .setURL("https://nodejs.org/api/process.html#event-unhandledrejection")
      .addFields(
          { name: "Reason", value: `\`\`\`${inspect(reason, { depth: 0 }).slice(0, 1000)}\`\`\`` },
          { name: "Promise", value: `\`\`\`${inspect(promise, { depth: 0 }).slice(0, 1000)}\`\`\`` }
      )
      .setTimestamp()
    ]})
  })

  process.on('uncaughtException', (err, origin) => {
    console.log(err, "\n", origin);
    return errorchannel.send({embeds: [
      new EmbedBuilder()
      .setColor('Red')
      .setTitle("Uncaught Exception/Catch")
      .setURL("https://nodejs.org/api/process.html#event-uncaughtexception")
      .addFields(
          { name: "Error", value: `\`\`\`${inspect(err, { depth: 0 }).slice(0, 1000)}\`\`\`` },
          { name: "Origin", value: `\`\`\`${inspect(origin, { depth: 0 }).slice(0, 1000)}\`\`\`` }
      )
      .setTimestamp()
    ]})
  })

  process.on("uncaughtExceptionMonitor", (err, origin) => {
    console.log(err, "\n", origin)
    return errorchannel.send({embeds: [
      new EmbedBuilder()
      .setColor('Red')
      .setTitle("Uncaught Exception Monitor")
      .setURL("https://nodejs.org/api/process.html#event-uncaughtexceptionmonitor")
      .addFields(
          { name: "Error", value: `\`\`\`${inspect(err, { depth: 0 }).slice(0, 1000)}\`\`\`` },
          { name: "Origin", value: `\`\`\`${inspect(origin, { depth: 0 }).slice(0, 1000)}\`\`\`` }
      )
      .setTimestamp()
    ]})
  })

  process.on('warning', (warn) => {
    console.log(warn)
    return errorchannel.send({embeds: [
      new EmbedBuilder()
      .setColor('Red')
      .setTitle("Uncaught Exception Monitor Warning")
      .setURL("https://nodejs.org/api/process.html#event-warning")
      .addFields(
          { name: "Warning", value: `\`\`\`${inspect(warn, { depth: 0 }).slice(0, 1000)}\`\`\`` }
      )
      .setTimestamp()
    ]})
  })

  // events handler
  fs.readdirSync('./events/').forEach(directory => {
    const files = fs.readdirSync(`./events/${directory}/`).filter(file => file.endsWith('.js'));

    if (!files || files.length <= 0) return console.log(chalk.red(`${directory} events = 0`))

    const eventsPath = path.join(__dirname, '../../..', `events/${directory}`);
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
  
    for (const file of eventFiles) {
      const filePath = path.join(eventsPath, file);
      const event = require(filePath);
      if (event.once) {
        client.once(event.name, (...args) => event.run(...args, client));
      } else {
        client.on(event.name, (...args) => event.run(...args, client));
      }
    }
  })
}

module.exports = { loadHandlers }