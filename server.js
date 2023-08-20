require("dotenv").config();
require("./src/utils/cleanup"); // Start the daily cleanup process
const fs = require("fs");
const path = require("path");
const archiveDirectory = path.join(__dirname, "./src/utils/data-archive/");
const { connectDB } = require("./src/utils/db");
const { start: bot } = require("./src/discord/bot");
const { sentryLogging } = require("./src/sentry/sentry");
const express = require("express");
const app = express();
const routes = require("./src/api/routes");
const { errorHandler } = require("./src/api/middlewares");
const { loadWebhookSubs } = require('./src/utils/webhook');

// Make sure the archive directory exists if not create it
if (!fs.existsSync(archiveDirectory)) {
  fs.mkdirSync(archiveDirectory);
}

// Use JSON middleware
app.use(express.json());

// Use your routes
app.use("/api", routes);

// Error handling middleware
app.use(errorHandler);

// Connect to the database
try {
  connectDB();
  console.log('Successfully connected to Database');
} catch (err) {
  console.error('Error connecting to Database', err);
  process.exit(1);
}

// Load Webhook Subscriptions from Database
loadWebhookSubs();

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));

(async () => {
  sentryLogging();
  bot();
})();