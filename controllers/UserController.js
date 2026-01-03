const db = require('../models');
const { Op } = require('sequelize');
const { uid } = require('uid');
const { hashPassword } = require('../utils/auth');
const logActivity = require('../utils/logActivity');

const listUsers = async (req, res) => {
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
                { email: { [Op.like]: `%${search}%` } },
                { license_key: { [Op.like]: `%${search}%` } },
                { phone: { [Op.like]: `%${search}%` } }
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
            layout: 'layout',
            query: req.query
        });

    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
};

const updateUser = async (req, res) => {
    try {
        const { id, full_name, phone, email, role, balance_adjustment } = req.body;

        const user = await db.User.findByPk(id);
        if (!user) {
            return res.status(404).send('User not found');
        }

        // Update basic info
        await user.update({
            full_name,
            phone,
            email,
            role
        });

        // Handle Password Update if provided
        const { password } = req.body;
        if (password && password.trim() !== '') {
            const hashedPassword = await hashPassword(password);
            await user.update({ password: hashedPassword });
            await logActivity(req.session.userId, 'USER_UPDATE', 0, null, req, id.toString() + ' (Password Changed)');
        }

        // Log Info Update
        await logActivity(req.session.userId, 'USER_UPDATE', 0, user.balance, req, id.toString());

        // Handle deferred balance update
        const adjustment = parseFloat(balance_adjustment);
        if (!isNaN(adjustment) && adjustment !== 0) {
            await user.increment('balance', { by: adjustment });

            // Re-fetch updated user for accurate balance
            const updatedUser = await db.User.findByPk(id);

            if (adjustment > 0) {
                // Was DEPOSIT, changing to BALANCE_UPDATE per user request for admin adjustments
                await logActivity(req.session.userId, 'BALANCE_UPDATE', adjustment, updatedUser.balance, req, id.toString());
            } else {
                await logActivity(req.session.userId, 'BALANCE_UPDATE', adjustment, updatedUser.balance, req, id.toString());
            }
        }

        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating user');
    }
};

const bulkDeleteUsers = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send('No IDs provided');
        }

        await db.User.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        });

        await logActivity(req.session.userId, 'BULK_DELETE_USER', 0, null, req, ids.join(','));

        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error deleting users' });
    }
};

const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.session.userId == id) {
            return res.redirect('/admin/users');
        }

        const user = await db.User.findByPk(id);
        const email = user ? user.email : 'Unknown';

        await db.User.destroy({ where: { id } });

        await logActivity(req.session.userId, 'DELETE_USER', 0, null, req, id.toString());

        res.redirect('/admin/users');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting user');
    }
};

const updateBalance = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, type, note } = req.body; // type: 'add' or 'subtract'

        const user = await db.User.findByPk(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const value = parseFloat(amount);
        if (isNaN(value) || value <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        let newBalance = parseFloat(user.balance);
        if (type === 'add') {
            newBalance += value;
        } else if (type === 'subtract') {
            newBalance -= value;
        }

        await user.update({ balance: newBalance });

        // If ADD -> DEPOSIT (TXN ID), If SUBTRACT -> BALANCE_UPDATE (User ID as Target)
        // User Request: Always "Information Change" (BALANCE_UPDATE) with amount.
        const txnId = id.toString();

        await logActivity(req.session.userId, 'BALANCE_UPDATE', type === 'add' ? value : -value, newBalance, req, txnId);

        res.json({ success: true, newBalance, message: 'Balance updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating balance' });
    }
};

module.exports = { listUsers, updateUser, bulkDeleteUsers, deleteUser, updateBalance };
