const db = require('../models');
const { hashPassword } = require('../utils/auth');
const logActivity = require('../utils/logActivity');

const dashboard = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.session.userId);

        // Fetch active orders
        const activeOrders = await db.Order.findAll({
            where: {
                user_id: user.id,
                status: 'completed',
                expiry_date: { [db.Sequelize.Op.gt]: new Date() }
            },
            order: [['expiry_date', 'DESC']]
        });

        // Use a client-specific layout
        res.render('client/dashboard', {
            layout: 'layout_client',
            user: user,
            activeOrders: activeOrders,
            activeTab: 'dashboard',
            path: '/dashboard'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading dashboard');
    }
};

const profile = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.session.userId);

        res.render('client/profile', {
            layout: 'layout_client',
            user: user,
            activeTab: 'profile',
            success: req.query.success,
            error: req.query.error
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading profile');
    }
};

const updateProfile = async (req, res) => {
    try {
        const { full_name, phone, password, confirm_password } = req.body;
        const user = await db.User.findByPk(req.session.userId);

        const updates = {
            full_name,
            phone
        };

        // Validate Password Change
        if (password && password.trim() !== '') {
            if (password !== confirm_password) {
                return res.redirect('/client/profile?error=Mật khẩu xác nhận không khớp');
            }
            updates.password = await hashPassword(password);

            await logActivity(user.id, 'USER_UPDATE', 0, null, req, 'Tự thay đổi mật khẩu');
        }

        await user.update(updates);

        // Update session info if needed
        req.session.full_name = full_name;

        await logActivity(user.id, 'USER_UPDATE', 0, null, req, 'Cập nhật thông tin cá nhân');

        res.redirect('/client/profile?success=Cập nhật thông tin thành công');
    } catch (error) {
        console.error(error);
        res.redirect('/client/profile?error=Lỗi hệ thống');
    }
}


const deposit = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.session.userId);

        // Fetch Settings
        const settings = await db.Setting.findAll({
            where: {
                key: ['bank_code', 'bank_account_number', 'bank_account_name', 'transaction_prefix']
            }
        });

        const settingsMap = {};
        settings.forEach(s => settingsMap[s.key] = s.value);

        // Generate Syntax
        const prefix = settingsMap.transaction_prefix || 'NAP';
        const syntax = `${prefix}${user.id}`;

        res.render('client/deposit', {
            layout: 'layout_client',
            user: user,
            activeTab: 'deposit',
            bank: {
                name: settingsMap.bank_code || 'MBBank',
                account: settingsMap.bank_account_number || '0000000000',
                holder: settingsMap.bank_account_name || 'ADMIN',
                syntax: syntax
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading deposit page');
    }
};

const getBalance = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ balance: user.balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching balance' });
    }
};

const history = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.session.userId);
        const tab = req.params.tab || req.query.tab || 'orders';
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        let data = [];
        let totalItems = 0;

        if (tab === 'orders') {
            const { count, rows } = await db.Order.findAndCountAll({
                where: { user_id: user.id },
                order: [['createdAt', 'DESC']],
                limit,
                offset
            });
            totalItems = count;
            data = rows;
        } else if (tab === 'deposits') {
            const { count, rows } = await db.ActivityLog.findAndCountAll({
                where: {
                    userId: user.id,
                    action: 'DEPOSIT'
                },
                order: [['createdAt', 'DESC']],
                limit,
                offset
            });
            totalItems = count;
            data = rows;
        }

        const totalPages = Math.ceil(totalItems / limit);

        res.render('client/history', {
            layout: 'layout_client',
            user: user,
            activeTab: 'history',
            currentTab: tab,
            data: data,
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems,
            limit: limit,
            path: `/history/${tab}`,
            query: req.query
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading history');
    }
};

const buy = async (req, res) => {
    try {
        const user = await db.User.findByPk(req.session.userId);

        // Fetch products with their packages
        const products = await db.Product.findAll({
            where: { status: 'active' }, // Assuming active status check is good practice
            include: [{
                model: db.Package,
                as: 'packages'
            }],
            order: [['createdAt', 'ASC']]
        });

        res.render('client/buy', {
            layout: 'layout_client',
            user: user,
            activeTab: 'buy',
            products: products,
            path: '/buy'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading buy page');
    }
};

const processBuy = async (req, res) => {
    const t = await db.sequelize.transaction();
    try {
        const { package_id, duration_months } = req.body;
        const user = await db.User.findByPk(req.session.userId, { transaction: t });

        const pkg = await db.Package.findByPk(package_id, { transaction: t });
        if (!pkg) {
            await t.rollback();
            return res.json({ success: false, message: 'Gói không tồn tại' });
        }

        const product = await db.Product.findByPk(pkg.product_id, { transaction: t });
        if (!product) {
            await t.rollback();
            return res.json({ success: false, message: 'Sản phẩm không tồn tại' });
        }

        // Validate duration
        const allowedDurations = [1, 3, 6, 12];
        const month = parseInt(duration_months);
        if (!allowedDurations.includes(month)) {
            await t.rollback();
            return res.json({ success: false, message: 'Thời hạn không hợp lệ' });
        }

        // Calculate Price
        // Get discount from Product Config
        let discountPercent = 0;
        let discounts = {};
        if (product.discount_config) {
            if (typeof product.discount_config === 'string') {
                discounts = JSON.parse(product.discount_config);
            } else {
                discounts = product.discount_config;
            }
        }

        if (month === 3) discountPercent = discounts.month3 || 0;
        if (month === 6) discountPercent = discounts.month6 || 0;
        if (month === 12) discountPercent = discounts.year1 || 0;

        const basePrice = parseFloat(pkg.original_price);
        const subTotal = basePrice * month;
        const discountAmount = Math.round((subTotal * discountPercent) / 100);
        const totalAmount = subTotal - discountAmount;

        // Check Balance
        if (parseFloat(user.balance) < totalAmount) {
            await t.rollback();
            return res.json({ success: false, message: 'Số dư không đủ. Vui lòng nạp thêm tiền.' });
        }

        // Check for existing active order
        const activeOrder = await db.Order.findOne({
            where: {
                user_id: user.id,
                status: 'completed',
                expiry_date: { [db.Sequelize.Op.gt]: new Date() }
            },
            order: [['expiry_date', 'DESC']],
            transaction: t
        });

        // Deduct Balance
        user.balance = parseFloat(user.balance) - totalAmount;
        await user.save({ transaction: t });

        // Calculate Expiry
        let expiryDate = new Date();
        let upgradeMessage = '';

        if (activeOrder) {
            // Calculate remaining time
            const now = new Date();
            const remainingTime = activeOrder.expiry_date.getTime() - now.getTime();

            // Add remaining time to new duration
            expiryDate = new Date(now.getTime() + (month * 30 * 24 * 60 * 60 * 1000) + remainingTime);

            // Cancel old order
            activeOrder.status = 'cancelled';
            await activeOrder.save({ transaction: t });

            upgradeMessage = ` (Đã cộng dồn thời gian từ đơn #${activeOrder.id})`;
        } else {
            expiryDate.setDate(expiryDate.getDate() + (month * 30));
        }

        // Construct detailed package name
        const uidInfo = pkg.max_uids === 0 ? 'Unlimited UIDs' : `${pkg.max_uids} UIDs`;
        const packageName = `${product.name} - ${pkg.name} (${uidInfo})`;

        const order = await db.Order.create({
            user_id: user.id,
            package_name: packageName,
            product_name: product.name,
            package_id: pkg.id,
            product_id: product.id,
            amount: totalAmount,
            duration: month * 30, // Note: This stores the purchased duration, not total validity
            status: 'completed',
            expiry_date: expiryDate,
            payment_method: 'balance',
            hwid: null
        }, { transaction: t });

        // Log Activity
        await logActivity(user.id, 'BUY_PACKAGE', -totalAmount, user.balance, req, order.id.toString(), t);

        await t.commit();

        res.json({ success: true, message: 'Mua gói thành công!', redirect: '/history?tab=orders' });

    } catch (error) {
        await t.rollback();
        console.error(error);
        res.json({ success: false, message: 'Lỗi hệ thống' });
    }
};


module.exports = {
    dashboard,
    profile,
    updateProfile,
    deposit,
    getBalance,
    history,
    buy,
    processBuy
};
