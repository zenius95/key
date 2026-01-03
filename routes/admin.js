const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const SettingsController = require('../controllers/SettingsController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Dashboard
router.get('/admin', requireAuth, AdminController.getDashboard);

// Activity Logs
router.get('/admin/activity-logs', requireAuth, AdminController.getActivityLogs);

// Revenue Stats API
router.get('/api/admin/revenue-stats', requireAuth, AdminController.getRevenueStats);

// Settings
router.get('/admin/settings', requireAuth, SettingsController.redirectSettings);
router.get('/admin/settings/deposit', requireAuth, SettingsController.getSettings);
router.post('/admin/settings/deposit', requireAuth, SettingsController.saveSettings);

module.exports = router;
