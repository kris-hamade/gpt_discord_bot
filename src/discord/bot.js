const Discord = require("discord.js");
const personas = require("../utils/data-misc/personas.json");
const { generateResponse } = require("../openai/gpt");
const { preprocessUserInput } = require("../utils/preprocessor");
const {
  buildHistory,
  clearAllHistory,
  clearUsersHistory,
} = require("./historyLog");
const {
  getConfigInformation,
  getUptime,
  setGptModel,
  setGptTemperature,
} = require("../utils/data-misc/config");
const { getChatConfig, setChatConfig } = require("./chatConfig");

// Include the required packages for slash commands
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

// Create a new Discord client
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.MessageContent,
    Discord.GatewayIntentBits.DirectMessages,
    Discord.GatewayIntentBits.DirectMessageReactions,
    Discord.GatewayIntentBits.DirectMessageTyping,
  ],
});

// required persona vars
const personalities = personas;

async function handleMessage(message) {
  console.log(
    `Received a message from ${message.author.username} in ${message.channel.type}`
  );
  // Ignore messages from other bots
  if (message.author.bot) return;

  // Skip mention check in DMs
  if (
    !(message.channel instanceof Discord.DMChannel) &&
    !message.mentions.has(client.user.id)
  )
    return;

  // get nickname author and trim dicord user code string from message.
  let nickname = "";
  if (message.guild) {
    nickname = message.member.nickname || message.author.username;
  } else {
    // This is a DM, so the user doesn't have a nickname
    nickname = message.author.username;
  }

  // Get the user's config
  let userConfig = await getChatConfig(nickname);
  let currentPersonality = personalities[userConfig.currentPersonality];

  message.content = message.content.replace(/<@[!&]?\d+>/g, "").trim();

  // Show as typing in the discord channel
  message.channel.sendTyping();

  // Preprocess Message and Return Data from our DnD Journal / Sessions
  // Also sends user nickname to retrieve data about their character
  if (message.content !== "" && currentPersonality !== "assistant" && currentPersonality.type !== "wow") {
    dndData = await preprocessUserInput(message.content, nickname);
  } else {
    dndData = "No DnD Data Found";
  }

  // interaction with ChatGPT API starts here.
  try {
    // generate response from ChatGPT API
    // generate response from ChatGPT API
    let responseText = await generateResponse(
      message.content,
      currentPersonality,
      dndData,
      nickname,
      currentPersonality.name,
      userConfig.model,
      userConfig.temperature
    );

    // trim persona name from response text if it exists.
    responseText = responseText.replace(
      new RegExp(`${currentPersonality}: |\\(${currentPersonality}\\) `, "gi"),
      ""
    );

    //Chat History Use and Manipulation
    // Add the latest user message to the chat history
    buildHistory("user", nickname, message.content);

    //Add GPT Response to Chat History
    buildHistory("assistant", currentPersonality.name, responseText, nickname);

    // print trimmed response to discord
    return message.reply(responseText);
  } catch (err) {
    console.log(err.message);
    return message.reply("Unable to Generate Response");
  }
}

// Slash command configuration
const commands = [
  {
    name: 'personas',
    description: 'Manage personas',
    options: [
      {
        name: 'list',
        description: 'List all available personas',
        type: 1, // Discord's ApplicationCommandOptionType for SUB_COMMAND
      },
      {
        name: 'select',
        description: 'Change your current persona',
        type: 1, // Discord's ApplicationCommandOptionType for SUB_COMMAND
        options: [
          {
            name: 'name',
            type: 3, // Discord's ApplicationCommandOptionType for STRING
            description: 'The name of the persona',
            required: true,
          },
        ],
      },
    ],
  },
  {
    name: 'model',
    description: 'Change the GPT model',
    options: [
      {
        name: 'name',
        type: 3, // Discord's ApplicationCommandOptionType for STRING
        description: 'The name of the model',
        required: true,
      },
    ],
  },
  {
    name: 'temp',
    description: 'Set the GPT temperature',
    options: [
      {
        name: 'value',
        type: 10, // Discord's ApplicationCommandOptionType for NUMBER
        description: 'The temperature value',
        required: true,
      },
    ],
  },
  {
    name: 'uptime',
    description: 'Get the uptime of the bot',
  },
  {
    name: 'about',
    description: 'Get information about the bot',
  },
  {
    name: 'forgetme',
    description: 'Clear your chat history',
  },
  {
    name: 'forgetall',
    description: 'Clear all chat history',
  },
];

function start() {
  client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // Slash command registration
    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

    try {
      console.log('Started refreshing application (/) commands.');

      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands },
      );

      console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
      console.error(error);
    }
  });

  // Handling the interaction created when a user invokes your slash command.
  client.on('interactionCreate', async interaction => {
    console.log(`Received interaction: ${interaction.commandName}`);

    try {
      if (!interaction.isCommand()) return;

      const { commandName } = interaction;

      switch (commandName) {
        case 'personas':
          const subCommand = interaction.options.getSubcommand();
          if (subCommand === 'list') {
            // List available personas
            await interaction.reply(`Available personas are: ${Object.keys(personalities).join(", ")}`);
          } else if (subCommand === 'select') {
            // Switch to the selected persona
            const newPersona = interaction.options.getString('name').toLowerCase();
            if (Object.keys(personalities).map(key => key.toLowerCase()).includes(newPersona)) {
              userConfig = await getChatConfig(interaction.user.username);
              userConfig.currentPersonality = newPersona;
              setChatConfig(interaction.user.username, userConfig);  // Save the updated config
              await interaction.reply(`Switched to persona ${newPersona}.`);
            } else {
              await interaction.reply(`Invalid persona: ${newPersona}. \n Use one of these\n  ${Object.keys(personalities).join("\n  ")}`);
            }
          }
          break;

        case 'model':
          const modelName = interaction.options.getString('name');
          // get user's config
          userConfig = await getChatConfig(interaction.user.username);
          // update the user's config with the new model
          userConfig.model = modelName;
          // save the updated config
          setChatConfig(interaction.user.username, userConfig);
          await interaction.reply(`Model switched to ${modelName}`);
          break;

        case 'temp':
          const newTemp = interaction.options.getNumber('value');
          // get user's config
          userConfig = await getChatConfig(interaction.user.username);
          // update the user's config with the new temperature
          userConfig.temperature = newTemp;
          // save the updated config
          setChatConfig(interaction.user.username, userConfig);
          await interaction.reply(`Temperature set to ${newTemp}`);
          break;


        case 'uptime':
          const uptime = getUptime();
          await interaction.reply(`Uptime: ${uptime}`);
          break;

        case 'about':
          const configInfo = getConfigInformation();
          await interaction.reply(configInfo);
          break;

        case 'forgetme':
          const user = interaction.user.username;
          clearUsersHistory(user)
            .then(() => {
              interaction.reply(`--Memory of ${user} Erased--`);
            })
            .catch((err) => {
              interaction.reply(`Unable to erase memory of ${user}`);
            });
          break;

        case 'forgetall':
          clearAllHistory()
            .then(() => {
              interaction.reply("-- Memory Erased --");
            })
            .catch((err) => {
              interaction.reply("Unable to erase memory");
            });
          break;

        default:
          await interaction.reply('Unknown command');
      }
    } catch (error) {
      console.log(`Error handling command: ${error}`);
    }
  });

  client.on("messageCreate", handleMessage);

  client.login(process.env.DISCORD_TOKEN);
}
module.exports = {
  start,
};
