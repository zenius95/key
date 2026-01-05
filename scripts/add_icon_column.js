const db = require('../models');

async function migrate() {
    try {
        await db.sequelize.authenticate();
        console.log('Connection has been established successfully.');

        // Check if column exists first (optional, or just try-catch the alter)
        try {
            await db.sequelize.query("ALTER TABLE Categories ADD COLUMN icon VARCHAR(255) DEFAULT NULL;");
            console.log("Success: Added 'icon' column to Categories table.");
        } catch (err) {
            if (err.original && err.original.code === 'ER_DUP_FIELDNAME') {
                console.log("Info: Column 'icon' already exists in Categories table.");
            } else {
                throw err;
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration Error:', error);
        process.exit(1);
    }
}

migrate();
