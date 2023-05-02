const {
    Configuration,
    OpenAIApi
} = require("openai");

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function generateResponse(prompt, persona, dndData) {

    console.log("Generating response for prompt:", prompt); // Log the prompt
    console.log("Using persona:", persona); // Log the persona
    console.log("Using D&D Data:", dndData); // Log the D&D Data (if any)

    try {
        const response = await openai.createChatCompletion({
            model: "gpt-3.5-turbo", // gpt-3.5-turbo is latest ChatGPT API
            temperature: 1, // Stay 0-1, don't go above 1. 1 works good.
            messages: [{
                role: "system",
                content: persona + ": " + prompt + "\n" + dndData
            }]
        });

        const message = response.data.choices[0].message.content;

        console.log("Generated message:", message); // Log the generated message for debugging

        return message;
    } catch (error) {
        console.error("Error generating response:", error); // Log the error for debugging
        return ""; // Return an empty string if an error occurs
    }
}

module.exports = {
    generateResponse
};