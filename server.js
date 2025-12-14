const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
const { uid } = require('uid');
require('dotenv').config();
const { sequelize, License } = require('./models/License');
const { Op } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Static folder
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Basic Auth
const USERNAME = process.env.ADMIN_USER || 'admin';
const PASSWORD = process.env.ADMIN_PASS || 'password';

const authMiddleware = basicAuth({
    users: { [USERNAME]: PASSWORD },
    challenge: true,
    realm: 'License Manager'
});

// Sync Database
sequelize.sync().then(() => {
    console.log('Database synced successfully');
});


// API: Check or Create License
app.get('/license/:key', async (req, res) => {
    try {
        const { key } = req.params;

        let license = await License.findOne({ where: { key } });

        if (!license) {
            license = await License.create({
                key,
                client_name: '',
                status: 'inactive',
                expiry_date: null
            });
            console.log(`Created new inactive license: ${key}`);
        } else {
            // Auto Update Status based on Expiry Date
            if (license.expiry_date) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiry = new Date(license.expiry_date);

                let newStatus = license.status;
                if (expiry < today) {
                    newStatus = 'inactive';
                } else {
                    // Logic: If date >= today, force active.
                    // Note: This overrides 'trial' if the date is valid.
                    newStatus = 'active';
                }

                if (newStatus !== license.status) {
                    await license.update({ status: newStatus });
                    license.status = newStatus; // Update local object for response
                    console.log(`Auto-updated license ${key} status to ${newStatus}`);
                }
            }
        }

        res.json({
            success: true,
            data: {
                client_name: license.client_name,
                key: license.key,
                status: license.status,
                expiry_date: license.expiry_date
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// Update Route
app.post('/update', authMiddleware, async (req, res) => {
    try {
        const { id, client_name, status, expiry_date, key } = req.body;

        let newStatus = status;

        // Auto Update Status based on Expiry Date for manual updates
        if (expiry_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiry = new Date(expiry_date);

            if (expiry < today) {
                newStatus = 'inactive';
            } else {
                newStatus = 'active';
            }
        }

        await License.update({
            client_name,
            status: newStatus,
            expiry_date: expiry_date || null,
            key
        }, { where: { id } });
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error updating license');
    }
});


// Dashboard Routes (Auth Required)
app.get('/', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const search = req.query.search || '';
        const statusFilter = req.query.status || 'all';

        // Build Where Clause
        const whereClause = {};

        if (search) {
            whereClause[Op.or] = [
                { client_name: { [Op.like]: `%${search}%` } },
                { key: { [Op.like]: `%${search}%` } }
            ];
        }

        if (statusFilter !== 'all') {
            whereClause.status = statusFilter;
        }

        // Fetch paginated licenses
        const { count, rows } = await License.findAndCountAll({
            where: whereClause,
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        // Fetch stats separately (Global stats, independent of filter)
        const activeCount = await License.count({ where: { status: ['active', 'trial'] } });
        const inactiveCount = await License.count({ where: { status: 'inactive' } });
        const totalCount = await License.count();

        const totalPages = Math.ceil(count / limit);

        res.render('dashboard', {
            licenses: rows,
            currentPage: page,
            totalPages,
            search,         // Passed to view to fix ReferenceError
            statusFilter,   // Passed to view
            stats: {
                total: totalCount,
                active: activeCount,
                inactive: inactiveCount
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Database Error');
    }
});

// Create Manual Route
app.post('/create', authMiddleware, async (req, res) => {
    try {
        const { client_name, expiry_date } = req.body;
        await License.create({
            key: uid(16).toUpperCase().match(/.{1,4}/g).join('-'),
            client_name,
            status: 'active',
            expiry_date
        });
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error creating license');
    }
});

// Delete Route
app.get('/delete/:id', authMiddleware, async (req, res) => {
    try {
        await License.destroy({ where: { id: req.params.id } });
        res.redirect('/');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error deleting license');
    }
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
