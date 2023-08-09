const Discord = require("discord.js");
const { MessageAttachment } = require('discord.js');
const personas = require("../utils/data-misc/personas.json");
const { generateEventData, generateImage, generateResponse } = require("../openai/gpt");
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
const { deleteEvent, loadJobsFromDatabase } = require("../utils/eventScheduler");
const ScheduledEvent = require('../models/scheduledEvent');
const moment = require('moment-timezone');
const cronstrue = require('cronstrue');
const axios = require('axios');

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
  let nickname = message.guild ? (message.member ? message.member.nickname || message.author.username : message.author.username) : message.author.username;

  console.log(`Received a message from ${nickname} in ${message.channelId}`);

  // Ignore messages from other bots
  if (message.author.bot) return;

  // Skip mention check in DMs
  if (
    !(message.channel instanceof Discord.DMChannel) &&
    !message.mentions.has(client.user.id)
  )
    return;

  // Get the user's config
  let userConfig = await getChatConfig(nickname);
  let currentPersonality = personalities[userConfig.currentPersonality];

  message.content = message.content.replace(/<@[!&]?\d+>/g, "").trim();

  // Show as typing in the discord channel
  message.channel.sendTyping();

  console.log("THIS CURRENT PERSONALITY", currentPersonality);
  // Preprocess Message and Return Data from our DnD Journal / Sessions
  // Also sends user nickname to retrieve data about their character
  let dndData;
  if (message.content !== "" && currentPersonality !== "assistant" && currentPersonality.type !== "wow") {
    dndData = await preprocessUserInput(message.content, nickname);
  } else {
    dndData = "No DnD Data Found";
  }

  // Interaction with ChatGPT API starts here.
  try {
    // Generate response from ChatGPT API
    let responseText = await generateResponse(
      message.content,
      currentPersonality,
      dndData,
      nickname,
      currentPersonality.name,
      userConfig.model,
      userConfig.temperature
    );

    // Trim persona name from response text if it exists.
    responseText = responseText.replace(
      new RegExp(`${currentPersonality}: |\\(${currentPersonality}\\) `, "gi"),
      ""
    );

    // Chat History Use and Manipulation
    // Add the latest user message to the chat history
    buildHistory("user", nickname, message.content);

    // Add GPT Response to Chat History
    buildHistory("assistant", currentPersonality.name, responseText, nickname);

    // Print trimmed response to discord
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
    name: 'events',
    description: 'List all scheduled events',
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
  },
  {
    name: 'deleteevent',
    description: 'Delete a scheduled event',
    options: [
      {
        name: 'event',
        type: 3, // Discord's ApplicationCommandOptionType for STRING
        description: 'The name of the event you want to delete',
        required: true,
      },
    ],
  },
  {
    name: 'image',
    description: 'Generate, Transform, and Manipulate Images',
    options: [
      {
        name: 'generate',
        description: 'Generate an image from a description',
        type: 1, // Discord's ApplicationCommandOptionType for SUB_COMMAND
        options: [
          {
            name: 'description',
            type: 3, // Discord's ApplicationCommandOptionType for STRING
            description: 'The description of the image',
            required: true,
          },
        ],
      }
    ]
  }
]

function start() {
  client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    loadJobsFromDatabase(client); // Load jobs when the bot is ready

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

        case 'events':
          try {
            const events = await ScheduledEvent.find({});
            console.log("Fetched events:", events);
            if (events.length === 0) {
              await interaction.reply('No events are currently scheduled.');
            } else {
              let eventList = 'Scheduled Events:\n';
              events.forEach(event => {
                const eventTime = moment.tz(event.time, event.timezone);
                const formattedEventTime = eventTime.format('MMMM D, YYYY [at] h:mm A');
                const humanReadableFrequency = cronstrue.toString(event.frequency);
                const now = moment();
                const duration = moment.duration(eventTime.diff(now));
                const timeRemaining = [
                  duration.years() > 0 ? duration.years() + ' years' : null,
                  duration.days() > 0 ? duration.days() + ' days' : null,
                  duration.hours() > 0 ? duration.hours() + ' hours' : null,
                  duration.minutes() > 0 ? duration.minutes() + ' minutes' : null,
                ].filter(Boolean).join(', ');
                eventList += `- **${event.eventName}** on ${formattedEventTime} (Timezone: ${event.timezone}, Frequency: ${humanReadableFrequency}, Time Remaining: ${timeRemaining})\n`;
              });
              await interaction.reply(eventList);
            }
          } catch (error) {
            console.error(`Error fetching events: ${error}`);
            await interaction.reply('An error occurred while fetching the events.');
          }
          break;

        case 'schedule':
          const event = interaction.options.getString('event');
          interaction.reply("Generating Event Data: " + event);
          const reply = await generateEventData(event, interaction.channelId, client);
          await interaction.followUp(reply);
          break;

        case 'deleteevent':
          const eventName = interaction.options.getString('event');
          if (!eventName) {
            await interaction.reply(`Event name must be provided.`);
            return;
          }
          try {
            const result = await deleteEvent(eventName.toLowerCase()); // Using JavaScript's built-in toLowerCase
            if (result) {
              await interaction.reply(`Event with Name ${eventName} has been deleted.`);
            } else {
              await interaction.reply(`Event with Name ${eventName} could not be found or deleted.`);
            }
          } catch (error) {
            console.error(`Error deleting event: ${error}`);
            await interaction.reply('An error occurred while deleting the event.');
          }
          break;

        case 'image':
          try {
            // Acknowledge the interaction
            await interaction.deferReply();

            // Extract the description from the interaction
            const description = interaction.options.getString('description');

            // Call your generateImage function with the description provided
            const imageUrl = await generateImage(description);

            // Get the image using Axios and create an attachment using AttachmentBuilder
            axios
              .get(imageUrl, { responseType: 'arraybuffer' })
              .then(response => {
                const attachment = new Discord.AttachmentBuilder(response.data)
                  .setName('image.jpg')
                  .setDescription('Generated image');

                // Assuming you want to send the attachment as part of a follow-up message
                interaction.followUp({ content: `Generating image from description: ${description}`, files: [attachment] });
              })
              .catch(error => {
                console.error(error);
                interaction.followUp('Failed to get the generated image.');
              });
          } catch (err) {
            console.error(`Error generating image: ${err}`);
            await interaction.followUp(`An error occurred while generating the image. Please try again later.`);
          }
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
  client,
  start
};
