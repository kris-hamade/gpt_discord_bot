const Roll20Data = require("../models/roll20Data");
const controllers = require("./controllers");
const appEmitter = require("../utils/eventEmitter");

const API_KEY = process.env.API_KEY;

exports.errorHandler = function (err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something went wrong');
};

exports.authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || authHeader !== API_KEY) {
        return res.status(401).json({
            message: 'Unauthorized'
        });
    }

    next();
};

// Get current Journal /api/currentJournal
exports.getCurrentJournal = async (req, res) => {
    getCurrentRoll20Data('Journal', req, res);
};

// Get current Handouts /api/currentHandouts
exports.getCurrentHandouts = async (req, res) => {
    getCurrentRoll20Data('Handouts', req, res);
};

// Helper function to get current Roll20 data
async function getCurrentRoll20Data(type, req, res) {
    try {
        // Query MongoDB
        const data = await Roll20Data.find({}).lean();

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No data found in the database.`
            });
        }

        res.json({
            success: true,
            data,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'An error occurred.'
        });
    }
}

// WebSocket Handler
appEmitter.on('websocketMessage', async ({ ws, userId, content, type }) => {
    try {
        console.log({ userId, content, type }); // Logging for debugging

        // Authenticate the message here...

        // Process the message using GPT controller
        await controllers.handleGPTInteraction({ userId, content, type }, ws);

    } catch (error) {
        console.error("Error handling WebSocket message:", error);
        ws.send(JSON.stringify({ error: 'Error processing your request' }));
    }
});