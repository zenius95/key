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

const clientRoutes = require('./client');

router.use('/', setupRoutes);
router.use('/', authRoutes);
router.use('/', adminRoutes);
router.use('/', userRoutes);
router.use('/', productRoutes);
router.use('/', orderRoutes);
router.use('/', cronRoutes);
router.use('/', clientRoutes);

// Root Route - Handled by clientRoutes (which maps '/')
// router.get('/', ...);

module.exports = router;
