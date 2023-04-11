require('dotenv').config();
const { start: bot } = require('./src/discord/bot');
const { sentryLogging } = require('./src/sentry/sentry');

(async () => {
    sentryLogging();
    bot();
  })();