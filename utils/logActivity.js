const db = require('../models');

async function logActivity(userId, action, balanceChange = 0, newBalance = 0, req, transactionId = null) {
    try {
        let ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        if (ipAddress && ipAddress.substr(0, 7) == "::ffff:") {
            ipAddress = ipAddress.substr(7)
        }
        let userAgent = req.headers['user-agent'];

        await db.ActivityLog.create({
            userId,
            action,
            transactionId,
            balanceChange,
            newBalance,
            ipAddress,
            userAgent
        });
    } catch (error) {
        console.error('Error logging activity:', error);
    }
}

module.exports = logActivity;
