const db = require('../models');
const { comparePassword } = require('../utils/auth');
const logActivity = require('../utils/logActivity'); // We will need to extract logActivity too or import it from somewhere. 
// CHECK: server.js had logActivity defined inline. I need to extract it to utils/logActivity.js first or duplicating it here.
// Best practice: Extract logActivity to utils.

const { signData, generateUserDbKey, encryptKeyForStorage, decryptKeyFromStorage, encryptWithPrivateKey } = require('../utils/crypto');
const { Op } = require('sequelize');

const getLogin = (req, res) => {
    if (req.session.userId) {
        return res.redirect('/admin');
    }
    // Disable layout for login
    res.render('login', { error: null, layout: false });
};

const postLogin = async (req, res) => {
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

        // if (user.role !== 'admin') {
        //     return res.render('login', { error: 'Access denied. Administrator access only.', layout: false });
        // }

        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.full_name = user.full_name;
        req.session.balance = user.balance;

        // Update last login time
        await user.update({ last_login: new Date() });

        // Log Login
        await logActivity(user.id, 'LOGIN', 0, null, req);

        if (user.role === 'user') {
            return res.redirect('/');
        }
        res.redirect('/admin');
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Server error', layout: false });
    }
};

const logout = (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
};

const checkLicense = async (req, res) => {
    try {
        const userId = req.session.userId;
        const { hwid } = req.query;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (!hwid) {
            return res.status(200).json({ success: false, message: 'Missing HWID' });
        }

        // 1. Find Valid Order
        // Check for any completed order that has not expired
        const order = await db.Order.findOne({
            where: {
                user_id: userId,
                status: 'completed',
                expiry_date: {
                    [Op.gt]: new Date()
                }
            },
            order: [['expiry_date', 'DESC']] // Get the one expiring latest
        });

        if (!order) {
            return res.status(200).json({ success: false, message: 'No active license found or license expired.' });
        }

        // 2. Check HWID (Device Lock)
        if (!order.hwid) {
            // First time using this license, bind HWID
            await order.update({ hwid });
        } else if (order.hwid !== hwid) {
            // HWID mismatch
            return res.status(200).json({ success: false, message: 'License is bound to another device.' });
        }

        // 3. Key Distribution (Database Encryption Key)
        const user = await db.User.findByPk(userId);
        let plainDbKey;



        if (user.db_secret_key) {
            // Decrypt existing key
            plainDbKey = decryptKeyFromStorage(user.db_secret_key);
            if (!plainDbKey) {
                console.warn(`[Security] User ${userId} key decryption failed. Regenerating new key.`);
                // If decryption failed, we regeneratenew key.
                // NOTE: This invalidates previous client-side encrypted data.
            }
        }

        if (!plainDbKey) {
            // Generate new key
            plainDbKey = generateUserDbKey();
            const encryptedKey = encryptKeyForStorage(plainDbKey);
            await user.update({ db_secret_key: encryptedKey });
        }


        // Encrypt the key using Server's Private Key
        // Client must use Public Key to decrypt this.
        const rsaEncryptedDbKey = encryptWithPrivateKey(plainDbKey);

        // 4. Response
        // 4. Response
        const payload = {
            // userId: user.id, // Removed user info as requested
            // email: user.email,
            // full_name: user.full_name,
            // phone: user.phone,
            // role: user.role,
            // balance: user.balance,
            // license_key: user.license_key,
            databaseKey: rsaEncryptedDbKey, // Now RSA encrypted (Base64)
            licenseExpiry: order.expiry_date,
            timestamp: Date.now()
        };

        const signature = signData(payload);

        return res.json({
            success: true,
            data: payload,
            signature: signature
        });

    } catch (error) {
        console.error('Check License Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getUserInfo = async (req, res) => {
    try {
        const userId = req.session.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const user = await db.User.findByPk(userId, {
            attributes: ['id', 'email', 'full_name', 'phone', 'role', 'balance', 'license_key', 'avatar', 'avatar_type']
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        return res.json({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                phone: user.phone,
                role: user.role,
                balance: user.balance,
                license_key: user.license_key,
                avatar: user.avatar, // Add logic for default avatar if needed? 
                // Client probably handles display.
            }
        });

    } catch (error) {
        console.error('Get User Info Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = { getLogin, postLogin, logout, checkLicense, getUserInfo };
