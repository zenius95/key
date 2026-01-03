const db = require('../models');
const { hashPassword } = require('../utils/auth');
const crypto = require('crypto');

// Helper to generate random string
const randomString = (length) => crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
const randomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

async function seed() {
    try {
        console.log('Syncing database...');
        // Force sync to clear data or just simple sync? 
        // User asked to "import sample data", usually implies adding to empty or existing. 
        // Let's safe sync (alter: true) and maybe checking if admin exists.
        // But "seed data" often implies fresh start. Let's assume we create fresh data if specific users don't exist.
        // For simplicity and effectiveness, let's just create new data.

        await db.sequelize.sync();

        console.log('Seeding data...');

        // 1. Create Users
        const users = [];
        const passwordHash = await hashPassword('123456');

        // Admin
        let admin = await db.User.findOne({ where: { email: 'admin@example.com' } });
        if (!admin) {
            admin = await db.User.create({
                email: 'admin@example.com',
                password: passwordHash,
                full_name: 'Administrator',
                role: 'admin',
                balance: 10000000,
                last_login: new Date()
            });
            console.log('Created Admin: admin@example.com / 123456');
        } else {
            console.log('Admin already exists.');
        }
        users.push(admin);

        // Regular Users
        for (let i = 1; i <= 10; i++) {
            const email = `user${i}@example.com`;
            let user = await db.User.findOne({ where: { email } });
            if (!user) {
                user = await db.User.create({
                    email,
                    password: passwordHash,
                    full_name: `User ${i} Test`,
                    phone: `09${randomNumber(10000000, 99999999)}`,
                    role: 'user',
                    balance: randomNumber(0, 5000000),
                    license_key: randomString(32),
                    last_login: randomDate(new Date(2025, 0, 1), new Date()),
                    createdAt: randomDate(new Date(2024, 0, 1), new Date(2024, 11, 31))
                });
                console.log(`Created User: ${email}`);
            }
            users.push(user);
        }

        // 2. Create Products & Packages
        const products = [];
        const productNames = ['Tool Facebook Automation', 'Shopee Analytics Pro', 'Tiktok Seeding Tool', 'YouTube Uploader'];

        for (const name of productNames) {
            let product = await db.Product.findOne({ where: { name } });
            if (!product) {
                product = await db.Product.create({
                    name,
                    description: `Phần mềm ${name} hỗ trợ tự động hóa và phân tích dữ liệu hiệu quả cao.`,
                    status: 'active'
                });

                // Packages for this product
                await db.Package.bulkCreate([
                    { product_id: product.id, name: '1 Tháng', duration: 30, original_price: 100000, discount_percent: 0, final_price: 100000 },
                    { product_id: product.id, name: '3 Tháng', duration: 90, original_price: 270000, discount_percent: 10, final_price: 243000 },
                    { product_id: product.id, name: '1 Năm', duration: 365, original_price: 1000000, discount_percent: 20, final_price: 800000 },
                    { product_id: product.id, name: 'Vĩnh viễn', duration: 36500, original_price: 5000000, discount_percent: 0, final_price: 5000000 }
                ]);
                console.log(`Created Product: ${name}`);
            }
            products.push(product);
        }

        // Reload products to get packages
        const allProducts = await db.Product.findAll({ include: 'packages' });

        // 3. Create Activity Logs & Orders
        const actions = ['LOGIN', 'DEPOSIT', 'PURCHASE', 'BALANCE_UPDATE', 'USER_UPDATE'];

        for (const user of users) {
            // Random Login Logs
            const loginCount = randomNumber(5, 20);
            for (let j = 0; j < loginCount; j++) {
                await db.ActivityLog.create({
                    userId: user.id,
                    action: 'LOGIN',
                    ipAddress: `192.168.1.${randomNumber(1, 255)}`,
                    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    createdAt: randomDate(new Date(2025, 0, 1), new Date())
                });
            }

            // Random Deposits
            if (user.role !== 'admin') {
                const depositCount = randomNumber(1, 5);
                for (let k = 0; k < depositCount; k++) {
                    const amount = randomNumber(100000, 2000000);
                    await db.ActivityLog.create({
                        userId: user.id,
                        action: 'DEPOSIT',
                        transactionId: `TXN-${randomString(8).toUpperCase()}`,
                        balanceChange: amount,
                        newBalance: user.balance, // Simplified logic, just random
                        createdAt: randomDate(new Date(2025, 0, 1), new Date())
                    });
                }
            }
        }

        // Random Orders
        for (let m = 0; m < 20; m++) {
            const user = randomElement(users);
            const product = randomElement(allProducts);
            if (!product.packages || product.packages.length === 0) continue;
            const pkg = randomElement(product.packages);

            const status = randomElement(['completed', 'pending', 'cancelled', 'expired']);
            const created = randomDate(new Date(2025, 0, 1), new Date());
            const expiry = new Date(created);
            expiry.setDate(expiry.getDate() + pkg.duration);

            await db.Order.create({
                user_id: user.id,
                product_id: product.id,
                package_id: pkg.id,
                package_name: pkg.name,
                product_name: product.name,
                amount: pkg.final_price,
                duration: pkg.duration,
                status: status,
                expiry_date: expiry,
                payment_method: 'wallet',
                createdAt: created
            });
        }

        console.log('Seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
}

seed();
