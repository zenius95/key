const db = require('../models');
const { Op } = require('sequelize');
const logActivity = require('../utils/logActivity');

const listOrders = async (req, res) => {
    try {
        // console.log("DEBUG: listOrders called"); 
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

        // If product_id is provided, filter by product_id
        if (product_id && !isNaN(parseInt(product_id))) {
            whereClause.product_id = parseInt(product_id);
        }

        if (search) {
            const searchCondition = [];

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
            revenue: await db.Order.sum('amount', { where: { status: 'completed' } }) || 0
        };

        const products = await db.Product.findAll();
        const users = await db.User.findAll({ attributes: ['id', 'full_name', 'email'] });
        const packages = await db.Package.findAll({ include: [{ model: db.Product, as: 'product' }] });

        res.render('admin/orders', {
            orders: rows,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            searchQuery: search || '',
            statusFilter: status || 'all',
            productFilter: product_id || '',
            stats,
            products,
            allProducts: products,
            allUsers: users,
            allPackages: packages,
            user: req.session,
            activeTab: 'orders',
            layout: 'layout',
            query: req.query
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
};


const createOrder = async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).send('Unauthorized');
        }

        const { user_id, package_id, duration } = req.body;
        const pkg = await db.Package.findByPk(package_id, {
            include: [{ model: db.Product, as: 'product' }]
        });

        if (!pkg) {
            return res.status(404).send('Package not found');
        }

        const durationMonths = parseInt(duration);
        const amount = parseFloat(pkg.original_price) * durationMonths;
        const durationDays = durationMonths * 30; // Approximation

        const order = await db.Order.create({
            user_id: user_id, // Assigned by Admin
            package_name: pkg.name,
            product_name: pkg.product ? pkg.product.name : 'Unknown', // Snapshot
            amount: amount,
            duration: durationDays,
            status: 'completed' // Admin created orders are completed by default
        });

        await logActivity(req.session.userId, 'CREATE_ORDER', 0, null, req, order.id.toString());

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

                // Compare Level: Price (monthly) + ID
                // Use original_price as base
                const currentPrice = currentPkg ? parseFloat(currentPkg.original_price) : 0;
                const newPrice = parseFloat(pkg.original_price);

                const currentLevel = (currentPrice * 1000000) + (currentPkg ? currentPkg.id : 0);
                const newLevel = (newPrice * 1000000) + pkg.id;

                if (newLevel <= currentLevel) {
                    // Not an upgrade
                }

                // Calculate cumulative expiry
                let baseDate = new Date(activeOrder.expiry_date);
                if (baseDate < new Date()) baseDate = new Date();
                baseDate.setDate(baseDate.getDate() + durationDays);

                // Update current order with new package and extended expiry
                const upgradeOrder = await db.Order.create({
                    user_id,
                    product_id: pkg.product_id,
                    package_id: pkg.id,
                    package_name: pkg.name,
                    product_name: pkg.product ? pkg.product.name : 'Unknown',
                    amount: amount,
                    duration: durationDays,
                    status: 'completed',
                    expiry_date: baseDate,
                    hwid: activeOrder.hwid // Transfer HWID
                });

                await logActivity(req.session.userId, 'UPGRADE_ORDER', 0, null, req, upgradeOrder.id.toString());

                // Cancel old active order
                await activeOrder.update({ status: 'cancelled' });

            } else {
                // No active order, create new
                const expiry = new Date();
                expiry.setDate(expiry.getDate() + durationDays);

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
};

const updateOrder = async (req, res) => {
    try {
        const { id, status, amount, payment_method } = req.body;

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

        await logActivity(req.session.userId, 'UPDATE_ORDER', 0, null, req, id.toString());

        res.redirect('/admin/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating order');
    }
};

const deleteOrder = async (req, res) => {
    try {
        const id = req.params.id;
        await db.Order.destroy({ where: { id } });

        await logActivity(req.session.userId, 'DELETE_ORDER', 0, null, req, id.toString());

        res.redirect('/admin/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting order');
    }
};

const bulkDeleteOrders = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send('No IDs provided');
        }

        await db.Order.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        });

        // For bulk delete, maybe join IDs with comma? 
        // User said "Only save ID". Multiple IDs? 
        // Let's save comma separated IDs for bulk.
        await logActivity(req.session.userId, 'BULK_DELETE_ORDER', 0, null, req, ids.join(','));

        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error deleting orders' });
    }
};

module.exports = { listOrders, createOrder, updateOrder, deleteOrder, bulkDeleteOrders };
