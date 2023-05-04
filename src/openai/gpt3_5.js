const fs = require('fs');
const path = require('path');
const {
    Configuration,
    OpenAIApi
} = require("openai");

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const haggleStatsFilePath = path.join('.', 'src', 'utils', 'data-misc', 'haggle-stats.json');

async function generateResponse(prompt, persona, dndData) {
    // Read in the file containing the haggle stats
    let haggleStats = JSON.parse(fs.readFileSync(`${haggleStatsFilePath}`, 'utf8'));

    haggleStatsPrompt = `You have died **${haggleStats.haggleDeaths} times** and Valon has had to spend **${haggleStats.moneySpent} GOLD** getting him back.`

    console.log("Generating response for prompt:", prompt); // Log the prompt
    console.log("Using persona:", persona); // Log the persona
    console.log("Using Haggle Stats:", haggleStatsPrompt); // Log the Haggle Stats (if any)
    console.log("Using D&D Data:", dndData); // Log the D&D Data (if any)

    try {
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{
                    role: "system",
                    content: persona
                },
                {
                    role: "system",
                    content: haggleStatsPrompt
                },
                {
                    role: "system",
                    content: "--START DUNGEONS AND DRAGONS CAMPAIGN DATA-- " + dndData + " --END DUNGEONS AND DRAGONS CAMPAIGN DATA--"
                },
                {
                    role: "user",
                    content: prompt
                }
            ]
        });


        const message = response.data.choices[0].message.content;

        console.log("Generated message:", message); // Log the generated message for debugging

        return message;
    } catch (error) {
        console.error("Error generating response:", error); // Log the error for debugging

        // Update Haggles Death Stats
        haggleStats.haggleDeaths += 1;
        haggleStats.moneySpent += 10;

        // Write the updated data back to the file
        fs.writeFileSync(`${haggleStatsFilePath}`, JSON.stringify(haggleStats, null, 2));
        const errorMessage = `ARGGGGGGGGGGH WEEEEEEE HEHE SCCCCCURRRR I CAN'T RECALL THAT MUCH FROM OUR ADVENTURES!!!! ARGGHEHEHEEEEE! NOOOOT AGAIN!!!! **HAGGLE EXPLODES AND DISINTEGRATES**. \`\`\`Valon throws more money on the ground and summons Haggle again.\`\`\` Woah, sorry about that. I have died soo many times, it's horribly painful each time.... hmm I think I've died **${haggleStats.haggleDeaths} times!** Master Valon is so mad he's had to spend **${haggleStats.moneySpent} GOLD** to get me back. But anyways, I can't remember that much. Try being a little more specific when asking about our travels. `;
        return errorMessage; // Return an empty string if an error occurs
    }
}

module.exports = {
    generateResponse
};