const express = require('express');
const router = express.Router();
const controller = require('./controllers');
const { authMiddleware, getCurrentJournal, getCurrentHandouts, verifyWebhookSecret } = require('./middlewares');
const multer = require('multer');
const upload = multer({ dest: './src/utils/data-uploads/' }); // This will save the uploaded files in an 'uploads' directory.

// GET Endpoints
// Check Bot Status, no API key required
router.get('/status', controller.status);

// Check Bot Config, no API key required
router.get('/config', controller.config);

// Check Bot Uptime, no API key required
router.get('/uptime', controller.uptime);

// Get Chat History, API key required
router.get('/chathistory', authMiddleware, controller.getChatHistory);

// Get current Journal, no API key required
router.get('/currentJournal', getCurrentJournal);

// Get current Handouts, no API key required
router.get('/currentHandouts', getCurrentHandouts);

// POST Endpoints
// Endpoint to replace Roll20 JSON Data, API key required
router.post('/uploadRoll20Data/:type', authMiddleware, upload.single('file'), controller.uploadRoll20Data);

// Webhook endpoint
router.post('/webhook', authMiddleware, controller.webhookHandler);

// Delete Endpoints
// Clear chat history, API key required
router.delete('/clearChatHistory', authMiddleware, controller.clearChatHistory);

// Clear uploaded data, API key required
router.delete('/clearUploadData', authMiddleware, controller.clearUploadData);

module.exports = router;