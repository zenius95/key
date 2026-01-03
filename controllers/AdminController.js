const db = require('../models');
const { Op } = require('sequelize');
const activityActions = require('../config/activity_actions');

const getDashboard = async (req, res) => {
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

        // Stats Logic from server.js
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfQuarter = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

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
                action: 'DEPOSIT',
                ...whereClause
            };

            const [usersCount, ordersCount, revenueSum] = await Promise.all([
                db.User.count({ where: whereClause }),
                db.Order.count({ where: whereClause }),
                db.ActivityLog.sum('balanceChange', { where: revenueWhere })
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
            layout: 'layout',
            query: req.query
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
};

const getActivityLogs = async (req, res) => {
    try {
        if (req.session.role !== 'admin') {
            return res.status(403).send('Access Denied');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const offset = (page - 1) * limit;
        const { user_search, action: actionFilter, search, type } = req.query;

        const whereClause = {};

        // Filter by Action
        if (actionFilter && actionFilter !== 'all') {
            whereClause.action = actionFilter;
        }

        // Search (Transaction ID Only now as Description is gone)
        if (search) {
            whereClause[Op.or] = [
                { transactionId: { [Op.like]: `%${search}%` } }
            ];
        }

        // Filter by User (Search) & Role
        const userWhere = {};
        if (user_search) {
            userWhere[Op.or] = [
                { full_name: { [Op.like]: `%${user_search}%` } },
                { email: { [Op.like]: `%${user_search}%` } }
            ];
        }

        if (type === 'admin') {
            userWhere.role = 'admin';
        } else if (type === 'client') {
            userWhere.role = 'user';
        }

        // Includes
        const include = [
            {
                model: db.User,
                as: 'user',
                attributes: ['id', 'full_name', 'email', 'role'],
                where: (user_search || type) ? userWhere : undefined,
                required: !!(user_search || type) // Inner join if filtering by user or role
            }
        ];

        const { count, rows } = await db.ActivityLog.findAndCountAll({
            where: whereClause,
            include,
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        res.render('admin/activity_logs', {
            logs: rows,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            actionFilter,
            userSearch: user_search,
            search,
            type,
            user: req.session,
            activeTab: 'activity_logs',
            layout: 'layout',
            query: req.query,
            activityActions // Pass config to view
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching logs');
    }
};


const getRevenueStats = async (req, res) => {
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

        const stats = await db.ActivityLog.findAll({
            attributes: [
                [db.sequelize.fn('DATE_FORMAT', db.sequelize.col('createdAt'), groupByFormat), 'timeLabel'],
                [db.sequelize.fn('SUM', db.sequelize.col('balanceChange')), 'total']
            ],
            where: {
                action: 'DEPOSIT',
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
};

module.exports = { getDashboard, getActivityLogs, getRevenueStats };

