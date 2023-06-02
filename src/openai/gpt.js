const fs = require("fs");
const path = require("path");
const {
  getCharacterLimit,
  getGptModel,
  getGptTemperature,
} = require("../utils/data-misc/config.js");
const { Configuration, OpenAIApi } = require("openai");
const { getHistory } = require("../discord/historyLog.js");
const { max, get } = require("lodash");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const haggleStatsFilePath = path.join(
  ".",
  "src",
  "utils",
  "data-misc",
  "haggle-stats.json"
);

// Set the max prompt size * 4 is about to calculate token size
// characterLimit is set in the config.js file
const maxPromptSize = getCharacterLimit();

// Set the max tokens to 1/4 of the max prompt size
//const maxTokens = maxPromptSize / 4;

async function generateResponse(
  prompt,
  persona,
  dndData,
  nickname,
  personality,
) {
  // Read in the file containing the haggle stats
  let haggleStats = JSON.parse(
    fs.readFileSync(`${haggleStatsFilePath}`, "utf8")
  );

  haggleStatsPrompt = `You have died **${haggleStats.haggleDeaths} times** and Valon has had to spend **${haggleStats.moneySpent} GOLD** getting him back.`;

  const chatHistory = await getSizedHistory(
    prompt,
    persona,
    haggleStatsPrompt,
    dndData,
    nickname,
    personality
  );

  console.log("Generating response for prompt:", prompt); // Log the prompt
  console.log("Using persona:", persona); // Log the persona
  console.log("Using Haggle Stats:", haggleStatsPrompt); // Log the Haggle Stats (if any)
  console.log("Using D&D Data:", dndData); // Log the D&D Data (if any)
  console.log("Using History:", chatHistory); // Log the History (if any)

  try {
    const response = await openai.createChatCompletion({
      model: getGptModel(),
      messages: [
        {
          role: "system",
          content: await personaBuilder(persona),
        },
        {
          role: "system",
          content: haggleStatsPrompt,
        },
        {
          role: "system",
          content:
            "--START DUNGEONS AND DRAGONS CAMPAIGN DATA-- " +
            dndData +
            " --END DUNGEONS AND DRAGONS CAMPAIGN DATA--",
        },
        {
          role: "system",
          content:
            "--START CHAT HISTORY-- " + chatHistory + " --END CHAT HISTORY--",
        },
        {
          role: "user",
          content: `${nickname} says: ${prompt}`,
        },
      ],
      temperature: getGptTemperature(),
    });

    const message = response.data.choices[0].message.content;
    
    // Log the number of tokens used
    console.log("Prompt tokens used:", response.data.usage.prompt_tokens);
    console.log(
      "Completion tokens used:",
      response.data.usage.completion_tokens
    );
    console.log("Total tokens used:", response.data.usage.total_tokens);

    console.log("Generated message:", message); // Log the generated message for debugging

    return message;
  } catch (error) {
    console.error("Error generating response:", error); // Log the error for debugging

    // Update Haggles Death Stats
    haggleStats.haggleDeaths += 1;
    haggleStats.moneySpent += 10;

    // Write the updated data back to the file
    fs.writeFileSync(
      `${haggleStatsFilePath}`,
      JSON.stringify(haggleStats, null, 2)
    );
    const errorMessage = `ARGGGGGGGGGGH WEEEEEEE HEHE SCCCCCURRRR I CAN'T RECALL THAT MUCH FROM OUR ADVENTURES!!!! ARGGHEHEHEEEEE! NOOOOT AGAIN!!!! **HAGGLE EXPLODES AND DISINTEGRATES**. \`\`\`Valon throws more money on the ground and summons Haggle again.\`\`\` Woah, sorry about that. I have died soo many times, it's horribly painful each time.... hmm I think I've died **${haggleStats.haggleDeaths} times!** Master Valon is so mad he's had to spend **${haggleStats.moneySpent} GOLD** to get me back. But anyways, I can't remember that much. Try being a little more specific when asking about our travels. `;
    return errorMessage; // Return an empty string if an error occurs
  }
}

async function getSizedHistory(
  prompt,
  persona,
  haggleStatsPrompt,
  dndData,
  nickname,
  personality
) {
  const promptLength = prompt.length;
  const personaLength = JSON.stringify(persona).length;
  const haggleStatsPromptLength = haggleStatsPrompt.length;
  const dndDataLength = JSON.stringify(dndData).length;

  const totalLength =
    promptLength + personaLength + haggleStatsPromptLength + dndDataLength;
  const remainingSize = maxPromptSize - totalLength;

  const historyItems = await getHistory(remainingSize, nickname, personality);
  return historyItems;
}

async function personaBuilder(persona) {
  const { name, description, mannerisms, sayings, generated_phrases } = persona;

  // Create the persona string
  let personaMessage = `You are ${name} ${description}.`;
  // If there are mannerisms, add them to the persona string
  if (mannerisms) {
    personaMessage += ` These are your mannerisms, which you are confined to ${mannerisms}`;
  }
  // If there are sayings, add them to the persona string
  if (sayings) {
    personaMessage += ` The following are your sayings: ${sayings.join(", ")}.`;
  }
  // If there are generated phrases, add them to the persona string
  if (generated_phrases) {
    personaMessage += ` You'll generate your own phrases for: ${generated_phrases.join(", ")}.`;
  }
  console.log(personaMessage);
  return personaMessage;
}

module.exports = {
  generateResponse,
};
