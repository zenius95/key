const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authMiddleware');

const setupRoutes = require('./setup');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const userRoutes = require('./users');
const productRoutes = require('./products');
const orderRoutes = require('./orders');
const cronRoutes = require('./cron');

router.use('/', setupRoutes);
router.use('/', authRoutes);
router.use('/', adminRoutes);
router.use('/', userRoutes);
router.use('/', productRoutes);
router.use('/', orderRoutes);
router.use('/', cronRoutes);

// Root Route
router.get('/', (req, res) => {
    res.redirect('/admin');
});

module.exports = router;
