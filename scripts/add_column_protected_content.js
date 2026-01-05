const db = require('../models');

async function migrate() {
    try {
        const queryInterface = db.sequelize.getQueryInterface();
        await queryInterface.addColumn('Modules', 'protectedContent', {
            type: db.Sequelize.TEXT('long'),
            allowNull: true
        });
        console.log('Column protectedContent added successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();
