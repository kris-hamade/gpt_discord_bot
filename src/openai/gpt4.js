const {
    Configuration,
    OpenAIApi
} = require("openai");

const {
    getPersonaText
} = require('./personas');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function generateResponse(prompt, persona = 'neutral') {
    const personaText = getPersonaText(persona);
    const fullPrompt = `${personaText}\n${prompt}`;

    try {
        const response = await openai.Completion.create({
            engine: 'gpt-4',
            prompt: fullPrompt,
            max_tokens: 100,
            n: 1,
            stop: null,
            temperature: 0.8,
        });

        return response.choices[0].text.trim();
    } catch (error) {
        if (error.response) {
            console.log(error.response.status);
            console.log(error.response.data);
        } else {
            console.log(error.message);
        }
    }
}

module.exports = { generateResponse };