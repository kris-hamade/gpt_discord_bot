const Sentry = require("@sentry/node");


const sentryLogging = async () => {
  Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  });
};

module.exports = { sentryLogging };