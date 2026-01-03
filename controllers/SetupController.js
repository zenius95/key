const db = require('../models');
const { hashPassword } = require('../utils/auth');

const getSetup = async (req, res) => {
    try {
        const userCount = await db.User.count();
        if (userCount > 0) {
            return res.redirect('/login');
        }
        // Disable layout for setup
        res.render('setup', { error: null, layout: false });
    } catch (error) {
        console.error(error);
        res.send('Server Error');
    }
};

const postSetup = async (req, res) => {
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
};

module.exports = { getSetup, postSetup };
