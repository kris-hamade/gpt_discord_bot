const Discord = require('discord.js');
const { generateResponse } = require('../openai/gpt4');

const client = new Discord.Client({
  intents: [Discord.GatewayIntentBits.Guilds, Discord.GatewayIntentBits.GuildMessages, Discord.GatewayIntentBits.MessageContent ],
});

async function handleMessage(message) {
  if (message.author.bot || !message.content.startsWith('!gpt4')) return;

  const args = message.content.slice(6).split(' ');
  const persona = args.shift().toLowerCase();
  const prompt = args.join(' ');

  const response = await generateResponse(prompt, persona);

  message.channel.send(response);
}

function start() {
  client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
  });

  client.on('message', handleMessage);

  client.login(process.env.DISCORD_TOKEN);
}

module.exports = { start };
