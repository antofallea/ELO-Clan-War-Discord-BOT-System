const discordClient = require('../src/bot/discordClient');
const client = new discordClient();
client.start();
module.exports = client;