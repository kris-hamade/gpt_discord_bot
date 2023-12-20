require("dotenv").config();
const Sentry = require("@sentry/node");
const Tracing = require("@sentry/tracing");
const { sentryLogging } = require("./src/sentry/sentry");
const fs = require("fs");
const path = require("path");
const express = require("express");
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const routes = require("./src/api/routes");
const { errorHandler } = require("./src/api/middlewares");
const { connectDB } = require("./src/utils/db");
const { start: bot } = require("./src/discord/bot");
const { loadWebhookSubs } = require('./src/utils/webhook');
const cors = require('cors');

const archiveDirectory = path.join(__dirname, "./src/utils/data-archive/");

// Initialize Sentry with Tracing
sentryLogging();

// Make sure the archive directory exists if not create it
if (!fs.existsSync(archiveDirectory)) {
  fs.mkdirSync(archiveDirectory);
}

// Sentry's request handler for tracing
app.use(Sentry.Handlers.requestHandler({
  transactionName: (req) => `${req.method} ${req.url}`, // Optional: customize transaction names
  tracingOrigins: ["localhost", /^\//], // Adjust according to your needs
}));

// Use CORS middleware
app.use(cors());

// Use JSON middleware
app.use(express.json());


// WebSocket server logic
wss.on('connection', (ws) => {
  console.log('WebSocket connection established');

  ws.on('message', (message) => {
    console.log('Received message:', message);
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Use your routes
app.use("/api", routes);

// Sentry's error handler should be before your other error handlers
app.use(Sentry.Handlers.errorHandler());

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
server.listen(port, () => console.log(`Server running on port ${port}`));

// Starting the bot
(async () => {
  bot();
})();
