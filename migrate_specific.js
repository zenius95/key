const db = require('./models');

async function migrate() {
    try {
        console.log('Syncing Product model...');
        await db.Product.sync({ alter: true });
        console.log('Product synced.');

        console.log('Syncing Package model...');
        await db.Package.sync({ alter: true });
        console.log('Package synced.');

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
