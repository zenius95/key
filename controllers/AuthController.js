const db = require('../models');
const { comparePassword } = require('../utils/auth');
const logActivity = require('../utils/logActivity'); // We will need to extract logActivity too or import it from somewhere. 
// CHECK: server.js had logActivity defined inline. I need to extract it to utils/logActivity.js first or duplicating it here.
// Best practice: Extract logActivity to utils.

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

module.exports = { getLogin, postLogin, logout };
