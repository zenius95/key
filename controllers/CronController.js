const db = require('../models');
const path = require('path');
const logActivity = require('../utils/logActivity');

const checkTransactions = async (req, res) => {
    try {
        const settings = await db.Setting.findAll();
        const config = {};
        settings.forEach(s => config[s.key] = s.value);

        const endpoint = config.transaction_endpoint;
        const prefix = config.transaction_prefix || 'NAP';

        if (!endpoint) {
            return res.json({ status: false, message: 'Transaction endpoint not configured' });
        }

        // Fetch Data (Test Mode or Real API)
        let data;
        if (endpoint === 'test') {
            const fs = require('fs').promises;
            const mockPath = path.join(__dirname, '..', 'mock', 'transactions.json'); // Adjusted path from server.js
            const fileContent = await fs.readFile(mockPath, 'utf8');
            data = JSON.parse(fileContent);
        } else {
            const response = await fetch(endpoint);
            data = await response.json();
        }

        if (!data.status || !data.transactions) {
            return res.json({ status: false, message: 'Invalid API response' });
        }

        let processedCount = 0;
        const processedIds = [];

        for (const trans of data.transactions) {
            if (trans.type !== 'IN') continue;

            const transactionId = String(trans.transactionID);
            const amount = parseFloat(trans.amount);
            const description = trans.description;

            // Check if processed
            const exists = await db.ActivityLog.findOne({
                where: {
                    transactionId: transactionId,
                    action: 'DEPOSIT'
                }
            });

            if (exists) continue;

            // Parse User ID from description (PREFIX<id> or PREFIX <id>)
            // Escape special regex chars in prefix just in case
            const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`${escapedPrefix}\\s*(\\d+)`, 'i');

            const match = description.match(regex);
            if (!match) continue;

            const userId = parseInt(match[1]);

            const user = await db.User.findByPk(userId);
            if (!user) continue;

            // Update Balance
            user.balance = parseFloat(user.balance) + amount;
            await user.save();

            // Log Activity
            await logActivity(user.id, 'DEPOSIT', amount, user.balance, req, transactionId);

            processedCount++;
            processedIds.push(transactionId);
        }

        res.json({
            status: true,
            message: 'Success',
            processed: processedCount,
            ids: processedIds
        });

    } catch (error) {
        console.error('Cron Error:', error);
        res.status(500).json({ status: false, message: error.message });
    }
};

module.exports = { checkTransactions };
