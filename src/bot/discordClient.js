const { Client, Partials, Collection } = require('discord.js');
const { QuickDB } = require('quick.db');
const { loadHandlers } = require('./functions/loadhandlers');
const db = new QuickDB();

class discordClient extends Client {
  constructor() {
    super({
      intents: [
        'GuildMessages',
        'GuildMembers',
        'DirectMessageTyping',
        'MessageContent',
        'Guilds',
        'GuildVoiceStates',
        'GuildIntegrations',
        'GuildBans'
      ],
      partials: [
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction
      ]
    })

    this.config = require('../../config')
    this.commands = new Collection()
    this.slashCommands = new Collection()
    this.db = db;
    this.prefix = this.config.default_prefix;
  }

  start() {
    loadHandlers(this)
    this.login(this.config.token)
  }
}

module.exports = discordClient;