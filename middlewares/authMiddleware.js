const db = require('../models');

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

module.exports = { requireAuth, checkSetup };
