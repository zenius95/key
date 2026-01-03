const express = require('express');
const basicAuth = require('express-basic-auth');
const path = require('path');
const { uid } = require('uid');
require('dotenv').config();
const { sequelize, License } = require('./models/License');
const { signData } = require('./utils/crypto');
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

// API: Verify License with HWID Binding
app.post('/api/verify', async (req, res) => {
    try {
        const { key, hwid } = req.body;

        if (!key || !hwid) {
            return res.status(400).json({ success: false, message: 'Missing key or hwid' });
        }

        let license = await License.findOne({ where: { key } });

        if (!license) {
            return res.json({ success: false, message: 'Invalid Key' });
        }

        // Check Status & Expiry
        if (license.status === 'inactive') {
            return res.json({ success: false, message: 'License Inactive' });
        }

        if (license.expiry_date) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const expiry = new Date(license.expiry_date);
            if (expiry < today) {
                // Auto-update status if needed, though usually we just deny
                if (license.status !== 'inactive') {
                    await license.update({ status: 'inactive' });
                }
                return res.json({ success: false, message: 'License Expired' });
            }
        }

        // HWID Logic
        if (!license.hwid) {
            // First time use, bind HWID
            await license.update({ hwid });
        } else if (license.hwid !== hwid) {
            return res.json({ success: false, message: 'Hardware Mismatch' });
        }

        // Payload Construction
        const payload = {
            status: 'valid',
            expiry: license.expiry_date,
            client: license.client_name,
            hwid: license.hwid
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

// API: Reset HWID
app.post('/api/reset-hwid', async (req, res) => {
    try {
        const { key } = req.body;
        const license = await License.findOne({ where: { key } });

        if (!license) {
            return res.status(404).json({ success: false, message: 'License not found' });
        }

        const MAX_RESETS = 5;
        if (license.reset_count >= MAX_RESETS) {
            return res.status(403).json({ success: false, message: 'Max resets reached' });
        }

        // Cooldown check (30 days)
        if (license.last_reset_at) {
            const now = new Date();
            const lastReset = new Date(license.last_reset_at);
            const diffTime = Math.abs(now - lastReset);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 30) {
                return res.status(403).json({ success: false, message: `Cooldown active. Try again in ${30 - diffDays} days.` });
            }
        }

        await license.update({
            hwid: null,
            reset_count: license.reset_count + 1,
            last_reset_at: new Date()
        });

        res.json({ success: true, message: 'HWID Reset Successful' });

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

// Bulk Delete Route
app.post('/delete-bulk', authMiddleware, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send('No IDs provided');
        }

        await License.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        });
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error deleting licenses' });
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
