const path = require('path');
const fs = require('fs');

const API_KEY = process.env.API_KEY; // Make sure to add your API key to your .env file

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

// Helper function to get current Roll20 data for a specific type
function getCurrentRoll20Data(type, req, res) {
    const dataJsonDir = path.join(__dirname, '../utils/data-json');

    // Find the most recent file that matches the type
    const serverFileName = fs.readdirSync(dataJsonDir).filter(fn => fn.endsWith(`${type}Export.json`)).sort().reverse()[0];
    if (!serverFileName) {
        return res.status(404).json({
            success: false,
            message: `No ${type}Export.json file found.`
        });
    }

    const filePath = path.join(dataJsonDir, serverFileName);

    try {
        // Read server file
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

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