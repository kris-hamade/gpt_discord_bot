// Configurations for chat_gpt_bot
// Instantiate moment.js for timestamping
const moment = require('moment');
// Sets the version of the bot
const version = "1.4.4.0";
// Sets Character limit in gpt.js and preprocessor.js
let characterLimit = 8000 * 4;

// Start tracking bot uptime
const startTime = moment();

function getCharacterLimit(model) {
    characterLimit = model === "gpt-4" ? 8000 * 4 : 4000 * 4;
    return characterLimit;
}

function getUptime() {
    const now = moment();
    const duration = moment.duration(now.diff(startTime));
    return duration.humanize();
}

function getConfigInformation() {
    return `Version: ${version}
  GPT Model: ${gptModel}
  GPT Temperature: ${gptTemperature}
  Character Limit: ${characterLimit}
  Start Time: ${startTime.format('YYYY-MM-DD HH:mm:ss')}
  Uptime: ${getUptime()}`;
}

module.exports = {
    version,
    getCharacterLimit,
    getConfigInformation,
    getUptime,
};