const db = require('./models');
const { decryptKeyFromStorage } = require('./utils/crypto');

async function debug() {
    try {
        const users = await db.User.findAll({
            where: {
                db_secret_key: { [db.Sequelize.Op.ne]: null }
            }
        });

        console.log(`Found ${users.length} users with keys.`);

        for (const user of users) {
            console.log(`User ID: ${user.id}, Email: ${user.email}`);
            console.log(`Stored Key: ${user.db_secret_key}`);
            const decrypted = decryptKeyFromStorage(user.db_secret_key);
            console.log(`Decrypted: ${decrypted}`);
            if (!decrypted) {
                console.log('FAIL: Decryption returned null.');
            } else {
                console.log('SUCCESS: Decryption worked.');
            }
        }
    } catch (err) {
        console.error('Debug script error:', err);
    }
}

debug();
