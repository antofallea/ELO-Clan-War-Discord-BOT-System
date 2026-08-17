const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

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
      const slashDefinitions = command.slashes || (command.slash ? [command.slash] : []);
      if(!command?.name || !slashDefinitions.length || slashDefinitions.some(slash => !slash?.name)) return console.log(chalk.red(`❌ /commands/${directory}/${file} non è stato caricato perchè non hai specificato il nome.`))
      const missing = [];
      if(!command.description || slashDefinitions.some(slash => !slash.description)) missing.push('descrizione')
      if(!command.usage) missing.push('usage')
      if(missing.length) console.log(chalk.yellow(`(/commands/${directory}/${file}) è consigliato un: ${missing.join(' & ')}`))

      client.commands.set(command.name, command)
      slashDefinitions.forEach(slash => { if(slash.name && slash.description) client.slashCommands.set(slash.name, slash) })
    })
  })
  client.on('error', (err) => {
    console.error('Discord client error:', err)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection:', reason, promise)
  })

  process.on('uncaughtException', (err, origin) => {
    console.error('Uncaught exception:', err, origin);
  })

  process.on('warning', (warn) => {
    console.warn('Node warning:', warn)
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
