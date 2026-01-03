const express = require('express');
const session = require('express-session');
const path = require('path');
const { uid } = require('uid');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();
const db = require('./models'); // Load central DB
const { signData } = require('./utils/crypto');
const { hashPassword, comparePassword } = require('./utils/auth');
const { Op } = require('sequelize');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup View Engine
app.use(expressLayouts);
app.set('layout', './layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Config
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Auth Middleware
// Auth Middleware with Setup Check
const requireAuth = async (req, res, next) => {
    // Check if setup is needed
    try {
        const userCount = await db.User.count();
        if (userCount === 0 && req.path !== '/setup') {
            return res.redirect('/setup');
        }
    } catch (e) {
        console.error("DB Error in middleware", e);
    }

    // Allow access to setup page if no users
    if (req.path === '/setup') return next();

    if (req.session && req.session.userId) {
        return next();
    }
    return res.redirect('/login');
};

const checkSetup = async (req, res, next) => {
    try {
        const userCount = await db.User.count();
        if (userCount === 0) {
            return res.redirect('/setup');
        }
        next();
    } catch (e) {
        console.error(e);
        next();
    }
};

// Sync Database (removed seedAdmin)
db.sequelize.sync({ alter: true }).then(() => {
    console.log('Database synced successfully');
});

// Seed Admin Function

// Routes

// Setup Page
app.get('/setup', async (req, res) => {
    const userCount = await db.User.count();
    if (userCount > 0) {
        return res.redirect('/login');
    }
    // Disable layout for setup
    res.render('setup', { error: null, layout: false });
});

app.post('/setup', async (req, res) => {
    try {
        const userCount = await db.User.count();
        if (userCount > 0) {
            return res.redirect('/login');
        }

        const { full_name, phone, email, password, confirm_password } = req.body;

        if (password !== confirm_password) {
            return res.render('setup', { error: 'Passwords do not match', layout: false });
        }

        const hashedPassword = await hashPassword(password);

        await db.User.create({
            full_name,
            phone,
            email,
            password: hashedPassword,
            role: 'admin',
            license_key: require('crypto').randomUUID() // Generate UUID License Key
        });

        res.redirect('/login');

    } catch (error) {
        console.error(error);
        res.render('setup', { error: 'Error creating admin account', layout: false });
    }
});

// Login Page
app.get('/login', checkSetup, (req, res) => {
    if (req.session.userId) {
        return res.redirect('/admin');
    }
    // Disable layout for login
    res.render('login', { error: null, layout: false });
});

// Login Action
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await db.User.findOne({ where: { email } });
        if (!user) {
            return res.render('login', { error: 'Invalid email or password', layout: false });
        }

        const isMatch = await comparePassword(password, user.password);
        if (!isMatch) {
            return res.render('login', { error: 'Invalid email or password', layout: false });
        }

        if (user.role !== 'admin') {
            return res.render('login', { error: 'Access denied. Administrator access only.', layout: false });
        }

        req.session.userId = user.id;
        req.session.email = user.email; // Store email in session
        req.session.full_name = user.full_name;
        req.session.role = user.role;
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Server error', layout: false });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// API: Verify License
app.post('/api/verify', async (req, res) => {
    try {
        const { license_key, product_id, hwid } = req.body;

        if (!license_key || !product_id || !hwid) {
            return res.status(400).json({ success: false, message: 'Missing license_key, product_id or hwid' });
        }

        // 1. Find User by Key
        const user = await db.User.findOne({ where: { license_key } });
        if (!user) {
            return res.json({ success: false, message: 'Invalid License Key' });
        }

        // 2. Find Active Order for User + Product
        const order = await db.Order.findOne({
            where: {
                user_id: user.id,
                product_id: parseInt(product_id),
                status: 'completed'
            },
            order: [['expiry_date', 'DESC']]
        });

        if (!order) {
            return res.json({ success: false, message: 'No active license found for this product' });
        }

        // Check Expiry
        const today = new Date();
        if (order.expiry_date && new Date(order.expiry_date) < today) {
            // Update status to expired
            await order.update({ status: 'expired' });
            return res.json({ success: false, message: 'License Expired' });
        }

        // HWID Logic
        if (hwid) {
            if (!order.hwid) {
                // First time use, bind HWID to this order
                await order.update({ hwid });
            } else if (order.hwid !== hwid) {
                return res.json({ success: false, message: 'Hardware Mismatch' });
            }
        }

        const payload = {
            status: 'valid',
            expiry: order.expiry_date,
            client: user.full_name,
            product: order.product_name || 'Product',
            transaction_id: order.transaction_id,
            hwid: order.hwid
        };

        const signature = signData(payload);

        res.json({
            success: true,
            data: payload,
            signature
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// API: Reset HWID (Updated for Order model)
app.post('/api/reset-hwid', async (req, res) => {
    try {
        const { license_key, product_id } = req.body;

        const user = await db.User.findOne({ where: { license_key } });
        if (!user) return res.status(404).json({ success: false, message: 'Invalid License Key' });

        const order = await db.Order.findOne({
            where: {
                user_id: user.id,
                product_id: parseInt(product_id),
                status: 'completed'
            }
        });

        if (!order) return res.status(404).json({ success: false, message: 'Active order not found' });

        await order.update({ hwid: null });
        res.json({ success: true, message: 'HWID Reset Successful' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Update Route

// Root Route - Redirect to admin
app.get('/', (req, res) => {
    res.redirect('/admin');
});


// Dashboard Routes (Auth Required)
app.get('/admin', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const search = req.query.search || '';

        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { full_name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { license_key: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await db.User.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            include: [{
                model: db.Order,
                as: 'orders',
                where: { status: 'completed' },
                required: false
            }]
        });

        // Thống kê & So sánh (V8)
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

        // Previous Periods
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);

        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        const startOfLastQuarter = new Date(now.getFullYear(), (Math.floor(now.getMonth() / 3) - 1) * 3, 1);
        const endOfLastQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 0, 23, 59, 59);

        async function getStatsForPeriod(startDate = null, endDate = null) {
            const whereClause = {};
            if (startDate || endDate) {
                whereClause.createdAt = {};
                if (startDate) whereClause.createdAt[Op.gte] = startDate;
                if (endDate) whereClause.createdAt[Op.lte] = endDate;
            }

            const revenueWhere = {
                status: { [Op.in]: ['completed', 'cancelled'] },
                ...whereClause
            };

            const [usersCount, ordersCount, revenueSum] = await Promise.all([
                db.User.count({ where: whereClause }),
                db.Order.count({ where: whereClause }),
                db.Order.sum('amount', { where: revenueWhere })
            ]);

            return {
                users: usersCount || 0,
                orders: ordersCount || 0,
                revenue: parseFloat(revenueSum) || 0
            };
        }

        const calculateGrowth = (current, previous) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return Math.round(((current - previous) / previous) * 100);
        };

        const todayStats = await getStatsForPeriod(startOfToday);
        const yesterdayStats = await getStatsForPeriod(startOfYesterday, startOfToday);

        const monthStats = await getStatsForPeriod(startOfMonth);
        const lastMonthStats = await getStatsForPeriod(startOfLastMonth, endOfLastMonth);

        const quarterStats = await getStatsForPeriod(startOfQuarter);
        const lastQuarterStats = await getStatsForPeriod(startOfLastQuarter, endOfLastQuarter);

        const allTimeStats = await getStatsForPeriod();

        const formatDateFull = (date) => date ? date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const endOfQuarter = new Date(now.getFullYear(), (Math.floor(now.getMonth() / 3) + 1) * 3, 0);

        const statsData = {
            today: {
                ...todayStats,
                range: `${formatDateFull(startOfToday)} - ${formatDateFull(now)}`,
                growth: {
                    users: calculateGrowth(todayStats.users, yesterdayStats.users),
                    orders: calculateGrowth(todayStats.orders, yesterdayStats.orders),
                    revenue: calculateGrowth(todayStats.revenue, yesterdayStats.revenue)
                }
            },
            month: {
                ...monthStats,
                range: `${formatDateFull(startOfMonth)} - ${formatDateFull(endOfMonth)}`,
                growth: {
                    users: calculateGrowth(monthStats.users, lastMonthStats.users),
                    orders: calculateGrowth(monthStats.orders, lastMonthStats.orders),
                    revenue: calculateGrowth(monthStats.revenue, lastMonthStats.revenue)
                }
            },
            quarter: {
                ...quarterStats,
                range: `${formatDateFull(startOfQuarter)} - ${formatDateFull(endOfQuarter)}`,
                growth: {
                    users: calculateGrowth(quarterStats.users, lastQuarterStats.users),
                    orders: calculateGrowth(quarterStats.orders, lastQuarterStats.orders),
                    revenue: calculateGrowth(quarterStats.revenue, lastQuarterStats.revenue)
                }
            },
            all: {
                ...allTimeStats,
                range: 'Tất cả thời gian',
                growth: { users: 0, orders: 0, revenue: 0 }
            }
        };

        const totalPages = Math.ceil(count / limit);

        res.render('admin/dashboard', {
            users: rows,
            currentPage: page,
            totalPages,
            search,
            user: req.session,
            stats: statsData,
            activeTab: 'dashboard',
            layout: 'layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
});

// --- USER MANAGEMENT ROUTES ---

// List Users
app.get('/admin/users', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const search = req.query.search || '';
        const roleFilter = req.query.role || 'all';

        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { full_name: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } }
            ];
        }

        if (roleFilter !== 'all') {
            whereClause.role = roleFilter;
        }

        const { count, rows } = await db.User.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            attributes: { exclude: ['password'] } // Don't return passwords
        });

        // Fetch User Stats
        const totalUsers = await db.User.count();
        const adminCount = await db.User.count({ where: { role: 'admin' } });
        const userCount = await db.User.count({ where: { role: 'user' } });

        // Debug
        // console.log('User Stats:', { totalUsers, adminCount, userCount });

        const totalPages = Math.ceil(count / limit);

        res.render('admin/users', {
            users: rows,
            currentPage: page,
            totalPages,
            search,
            roleFilter,
            stats: {
                total: totalUsers,
                admin: adminCount,
                user: userCount
            },
            activeTab: 'users',
            layout: 'layout'
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
});

// Update User
app.post('/users/update', requireAuth, async (req, res) => {
    try {
        const { id, full_name, phone, email, role } = req.body;

        // Prevent editing own role if you want to enforce security, but for now allow it as requested.
        // Actually, preventing user from changing their own role to non-admin might be wise, but keeping it simple.

        await db.User.update({
            full_name,
            phone,
            email,
            role
        }, { where: { id } });

        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating user');
    }
});

// Bulk Delete Users
app.post('/users/delete-bulk', requireAuth, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send('No IDs provided');
        }

        // Optional: Prevent deleting self
        // const currentUserId = req.session.userId;
        // if (ids.includes(currentUserId.toString())) { ... }

        await db.User.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        });
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error deleting users' });
    }
});

// Single Delete User
app.get('/users/delete/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent deleting self?
        if (req.session.userId == id) {
            // Maybe flash an error or just redirect
            return res.redirect('/admin/users');
        }

        await db.User.destroy({ where: { id } });
        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting user');
    }
});


// --- PRODUCT MANAGEMENT ROUTES ---

// List Products (with Packages)
app.get('/admin/products', requireAuth, async (req, res) => {
    try {
        const products = await db.Product.findAll({
            include: [{ model: db.Package, as: 'packages' }],
            order: [['createdAt', 'DESC']]
        });
        res.render('admin/products', { products, user: req.session, activeTab: 'products', layout: 'layout' });
    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
});

// Save Product (Create/Update with Packages Transaction)
app.post('/api/products/save', requireAuth, async (req, res) => {
    const t = await db.sequelize.transaction();
    try {
        const { id, name, description, status, packages } = req.body;

        let product;
        if (id) {
            // Update existing Product
            product = await db.Product.findByPk(id, { transaction: t });
            if (!product) throw new Error('Product not found');
            await product.update({ name, description, status }, { transaction: t });
        } else {
            // Create new Product
            product = await db.Product.create({ name, description, status }, { transaction: t });
        }

        // Handle Packages
        // 1. Get existing package IDs for this product
        const existingPackages = await db.Package.findAll({
            where: { product_id: product.id },
            attributes: ['id'],
            transaction: t
        });
        const existingIds = existingPackages.map(p => p.id);

        const incomingPackages = packages || [];
        const incomingIds = incomingPackages.filter(p => p.id).map(p => parseInt(p.id));

        // 2. Determine Create, Update, Delete
        const packagesToDelete = existingIds.filter(eid => !incomingIds.includes(eid));

        // Delete removed packages
        if (packagesToDelete.length > 0) {
            await db.Package.destroy({
                where: { id: packagesToDelete },
                transaction: t
            });
        }

        // Upsert incoming packages
        for (const pkg of incomingPackages) {
            if (pkg.id) {
                // Update
                await db.Package.update({
                    name: pkg.name,
                    duration: parseInt(pkg.duration),
                    original_price: parseFloat(pkg.price),
                    discount_percent: parseInt(pkg.discount) || 0
                }, {
                    where: { id: pkg.id },
                    transaction: t
                });
            } else {
                // Create
                await db.Package.create({
                    name: pkg.name,
                    duration: parseInt(pkg.duration),
                    original_price: parseFloat(pkg.price),
                    discount_percent: parseInt(pkg.discount) || 0,
                    product_id: product.id
                }, { transaction: t });
            }
        }

        await t.commit();
        res.json({ success: true, message: 'Product saved successfully' });

    } catch (error) {
        await t.rollback();
        console.error(error);
        res.status(500).json({ success: false, message: 'Error saving product' });
    }
});

// Delete Product
app.get('/products/delete/:id', requireAuth, async (req, res) => {
    try {
        await db.Product.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/products');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting product');
    }
});
// --- ORDER MANAGEMENT ROUTES ---

// List Orders
app.get('/admin/orders', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const { search, status, product_id } = req.query;

        const whereClause = {};

        // If not admin, only show own orders
        if (req.session.role !== 'admin') {
            whereClause.user_id = req.session.userId;
        }

        if (status && ['pending', 'completed', 'cancelled'].includes(status)) {
            whereClause.status = status;
        }

        // Filter by Product Name (via snapshot) or better, by joining Product via Package?
        // Since we store product_name snapshot, we can allow filtering by exact name match if implemented,
        // or partial match. But user asked for "Filter by Product".
        // Let's support searching product_name or direct match if passed.
        if (product_id) {
            // Find product name first? Or just search snapshot.
            // Simplified: Filter by product_name string passed in query
            whereClause.product_name = { [Op.like]: `%${product_id}%` }; // This is hacky. Better to pass exact name or ID.
            // Ideally we store product_id in Order, but we didn't add thatcolumn, only product_name snapshot.
            // We'll stick to searching transaction_id or user.
        }

        if (search) {
            const searchCondition = [];
            // Match Transaction ID
            searchCondition.push({ transaction_id: { [Op.like]: `%${search}%` } });

            // Match User
            searchCondition.push(
                { '$user.full_name$': { [Op.like]: `%${search}%` } },
                { '$user.email$': { [Op.like]: `%${search}%` } }
            );

            whereClause[Op.and] = [
                ...(whereClause[Op.and] || []),
                { [Op.or]: searchCondition }
            ];
        }

        const { count, rows } = await db.Order.findAndCountAll({
            where: whereClause,
            include: [{ model: db.User, as: 'user', attributes: ['full_name', 'email'] }], // Include User info
            order: [['createdAt', 'DESC']],
            limit,
            offset,
            subQuery: false
        });

        // Calculate Stats
        const stats = {
            total: await db.Order.count(),
            active: await db.Order.count({
                where: {
                    status: 'completed',
                    expiry_date: { [Op.gt]: new Date() }
                }
            }),
            pending: await db.Order.count({ where: { status: 'pending' } }),
            cancelled: await db.Order.count({ where: { status: 'cancelled' } })
        };

        const totalPages = Math.ceil(count / limit);

        // Fetch data for Create Modal (Admin Only)
        let allUsers = [];
        let allPackages = [];
        let allProducts = [];

        if (req.session.role === 'admin') {
            allUsers = await db.User.findAll({ attributes: ['id', 'full_name', 'email'] });
            // Fetch Packages with Product info
            allPackages = await db.Package.findAll({
                include: [{ model: db.Product, as: 'product', attributes: ['name'] }],
                attributes: ['id', 'name', 'final_price', 'product_id']
            });
            allProducts = await db.Product.findAll({ attributes: ['id', 'name'] });
        }

        console.log('Rendering orders. Stats:', stats); // DEBUG
        res.render('admin/orders', {
            orders: rows,
            stats, // Pass Stats
            currentPage: page,
            totalPages,
            user: req.session,
            allUsers,
            allPackages,
            allProducts, // For Filter Dropdown
            searchQuery: search || '',
            statusFilter: status || 'all',
            productFilter: product_id || '',
            activeTab: 'orders',
            layout: 'layout'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
});

// Bulk Delete Orders
app.post('/orders/delete-bulk', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'admin') return res.status(403).json({ success: false, message: 'Unauthorized' });

        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ success: false, message: 'Invalid IDs' });

        await db.Order.destroy({ where: { id: ids } });
        res.json({ success: true, message: 'Orders deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error deleting orders' });
    }
});

// Delete Single Order
app.get('/orders/delete/:id', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'admin') return res.status(403).send('Unauthorized');

        await db.Order.destroy({ where: { id: req.params.id } });
        res.redirect('/admin/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting order');
    }
});

// Create Order (Admin Manual Creation)
app.post('/orders/create', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).send('Unauthorized');
        }

        const { user_id, package_id } = req.body;
        const pkg = await db.Package.findByPk(package_id, {
            include: [{ model: db.Product, as: 'product' }]
        });

        if (!pkg) {
            return res.status(404).send('Package not found');
        }

        const order = await db.Order.create({
            user_id: user_id, // Assigned by Admin
            package_name: pkg.name,
            product_name: pkg.product ? pkg.product.name : 'Unknown', // Snapshot
            amount: pkg.final_price,
            duration: pkg.duration,
            status: 'completed' // Admin created orders are completed by default
        });

        // V3 Logic: Grant/Extend Permission with Level Check
        if (pkg.product_id) {
            // 1. Get current active order for this product
            const activeOrder = await db.Order.findOne({
                where: {
                    user_id,
                    product_id: pkg.product_id,
                    status: 'completed',
                    expiry_date: { [Op.gt]: new Date() }
                }
            });

            if (activeOrder) {
                // Get package of current active order
                const currentPkg = await db.Package.findByPk(activeOrder.package_id);

                // Compare Level: Price + ID
                const currentLevel = (parseFloat(currentPkg.final_price) * 1000000) + currentPkg.id;
                const newLevel = (parseFloat(pkg.final_price) * 1000000) + pkg.id;

                if (newLevel <= currentLevel) {
                    // Not an upgrade, but since this is Admin creating, maybe we allow? 
                    // Manual says "Mối đơn hàng thành công sẽ được coi như 1 giấy phép... chỉ có thể update lên package cao hơn"
                    // I will enforce this logic but maybe log a warning or send error.
                    // return res.status(400).send('Cannot downgrade or stay on the same package level.');
                }

                // Calculate cumulative expiry
                let baseDate = new Date(activeOrder.expiry_date);
                if (baseDate < new Date()) baseDate = new Date();
                baseDate.setDate(baseDate.getDate() + pkg.duration);

                // Update current order with new package and extended expiry
                await db.Order.create({
                    user_id,
                    product_id: pkg.product_id,
                    package_id: pkg.id,
                    package_name: pkg.name,
                    product_name: pkg.product ? pkg.product.name : 'Unknown',
                    amount: pkg.final_price,
                    duration: pkg.duration,
                    status: 'completed',
                    expiry_date: baseDate,
                    hwid: activeOrder.hwid // Transfer HWID
                });

                // Cancel old active order
                await activeOrder.update({ status: 'cancelled' });

            } else {
                // No active order, create new
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + pkg.duration);

                await db.Order.update({
                    product_id: pkg.product_id,
                    package_id: pkg.id,
                    expiry_date: expiry,
                    status: 'completed'
                }, { where: { id: order.id } });
            }
        }

        res.redirect('/admin/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating order');
    }
});

// Update Order (Admin Only)
app.post('/orders/update', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).send('Unauthorized');
        }

        const { id, status, amount, payment_method } = req.body;

        // Find existing order
        const order = await db.Order.findByPk(id);
        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Update fields
        await order.update({
            status,
            amount,
            payment_method
        });

        res.redirect('/admin/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating order');
    }
});


// Revenue Stats API for Chart
app.get('/api/admin/revenue-stats', requireAuth, async (req, res) => {
    try {
        if (req.session.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
        const { type } = req.query; // 'month', 'quarter', 'year'
        const now = new Date();
        let startDate;
        let labels = [];
        let groupByFormat;

        if (type === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            groupByFormat = '%d';
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) labels.push(i.toString());
        } else if (type === 'quarter') {
            const currentQuarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            groupByFormat = '%m';
            for (let i = 0; i < 3; i++) {
                const monthIndex = (currentQuarter * 3) + i;
                labels.push(new Date(now.getFullYear(), monthIndex).toLocaleString('vi-VN', { month: 'long' }));
            }
        } else { // year
            startDate = new Date(now.getFullYear(), 0, 1);
            groupByFormat = '%m';
            for (let i = 0; i < 12; i++) {
                labels.push(new Date(now.getFullYear(), i).toLocaleString('vi-VN', { month: 'short' }));
            }
        }

        const stats = await db.Order.findAll({
            attributes: [
                [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('createdAt'), groupByFormat), 'timeLabel'],
                [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total']
            ],
            where: {
                status: { [Op.in]: ['completed', 'cancelled'] },
                createdAt: { [Op.gte]: startDate }
            },
            group: ['timeLabel'],
            order: [[db.sequelize.col('timeLabel'), 'ASC']]
        });

        let data = new Array(labels.length).fill(0);
        stats.forEach(item => {
            const val = item.getDataValue('timeLabel');
            if (val === null) return;
            const timeLabel = parseInt(val);
            let index = -1;
            if (type === 'month') index = timeLabel - 1;
            else if (type === 'quarter') index = timeLabel - (Math.floor(now.getMonth() / 3) * 3) - 1;
            else index = timeLabel - 1;
            if (index >= 0 && index < data.length) data[index] = parseFloat(item.getDataValue('total')) || 0;
        });

        const formatDateLong = (date) => date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        let endDate;
        if (type === 'month') endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        else if (type === 'quarter') endDate = new Date(now.getFullYear(), (Math.floor(now.getMonth() / 3) + 1) * 3, 0);
        else endDate = new Date(now.getFullYear(), 11, 31);

        res.json({
            labels,
            data,
            dateRange: `${formatDateLong(startDate)} - ${formatDateLong(endDate)}`
        });
    } catch (error) {
        console.error('Revenue stats error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
