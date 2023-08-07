const Discord = require("discord.js");
const personas = require("../utils/data-misc/personas.json");
const { generateEventData, generateResponse } = require("../openai/gpt");
const { preprocessUserInput } = require("../utils/preprocessor");
const {
  buildHistory,
  clearAllHistory,
  clearUsersHistory,
} = require("./historyLog");
const {
  getConfigInformation,
  getUptime,
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
    `Received a message from ${message.member.nickname} in ${message.channelId}`
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
    nickname = message.member.nickname || Namemessage.member.nickname;
  } else {
    // This is a DM, so the user doesn't have a nickname
    nickname = Namemessage.member.nickname;
  }

  // Get the user's config
  let userConfig = await getChatConfig(nickname);
  let currentPersonality = personalities[userConfig.currentPersonality];

  message.content = message.content.replace(/<@[!&]?\d+>/g, "").trim();

  // Show as typing in the discord channel
  message.channel.sendTyping();

  console.log("THIS CURRENT PERSONALITY", currentPersonality);
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
  {
    name: 'schedule',
    description: 'Schedule an Event',
    options: [
      {
        name: 'event',
        type: 3, // Discord's ApplicationCommandOptionType for STRING
        description: 'Event name, date, time, and frequency of reminder',
        required: true,
      },
    ],
  }
]

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

    let userConfig;

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
              userConfig = await getChatConfig(interaction.member.nickname);
              userConfig.currentPersonality = newPersona;
              setChatConfig(interaction.member.nickname, userConfig);  // Save the updated config
              await interaction.reply(`Switched to persona ${newPersona}.`);
            } else {
              await interaction.reply(`Invalid persona: ${newPersona}. \n Use one of these\n  ${Object.keys(personalities).join("\n  ")}`);
            }
          }
          break;

        case 'model':
          const modelName = interaction.options.getString('name');
          userConfig = await getChatConfig(interaction.member.nickname);

          if (userConfig) {
            // Retrieve model from user's config and validate it
            const allowedModels = ["gpt-3.5-turbo", "gpt-3.5-turbo-16k", "gpt-4"];
            if (allowedModels.includes(modelName)) {
              // Update the user's config with the new model
              userConfig.model = modelName;
              // Save the updated config
              setChatConfig(interaction.member.nickname, userConfig);
              await interaction.reply(`Switched to GPT model ${modelName}.`);
            } else {
              await interaction.reply(`Invalid GPT model: ${modelName}. Allowed models: ${allowedModels.join(", ")}`);
            }
          }
          else {
            await interaction.reply(`Could not retrieve configuration for user ${interaction.member.nickname}`);
          }
          break;

        case 'temp':
          const newTemp = interaction.options.getNumber('value');
          userConfig = await getChatConfig(interaction.member.nickname);

          if (userConfig) {
            // Convert the input to a number in case it's a string
            const temperature = parseFloat(newTemp);

            // Validate temperature
            if (!isNaN(temperature) && temperature >= 0 && temperature <= 1) {
              // Update the user's config with the new temperature
              userConfig.temperature = temperature;
              // Save the updated config
              setChatConfig(interaction.member.nickname, userConfig);
              await interaction.reply(`Set GPT temperature to ${newTemp}.`);
            } else {
              await interaction.reply(`Invalid GPT temperature: ${newTemp}. Temperature should be between 0 and 1.`);
            }
          }
          else {
            await interaction.reply(`Could not retrieve configuration for user ${interaction.member.nickname}`);
          }
          break;

        case 'uptime':
          const uptime = getUptime();
          await interaction.reply(`Uptime: ${uptime}`);
          break;

        case 'about':
          userConfig = await getChatConfig(interaction.member.nickname);
          configInfo = getConfigInformation(userConfig.model, userConfig.temperature);
          await interaction.reply(configInfo);
          break;

        case 'forgetme':
          const user = interaction.member.nickname;
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

        case 'schedule':
          const event = interaction.options.getString('event');
          interaction.reply("Generating Event Data: " + event);
          const reply = await generateEventData(event, interaction.channelId, client);
          await interaction.followUp(reply);
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
  start
};
