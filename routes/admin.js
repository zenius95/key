const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const SettingsController = require('../controllers/SettingsController');
const ModuleController = require('../controllers/ModuleController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Dashboard
router.get('/admin', requireAuth, AdminController.getDashboard);

// Activity Logs
router.get('/admin/activity-logs', requireAuth, AdminController.getActivityLogs);

// Revenue Stats API
router.get('/admin/revenue-stats', requireAuth, AdminController.getRevenueStats);

// Settings
router.get('/admin/settings', requireAuth, SettingsController.redirectSettings);
router.get('/admin/settings/deposit', requireAuth, SettingsController.getSettings);
router.get('/admin/settings/deposit', requireAuth, SettingsController.getSettings);
router.post('/admin/settings/deposit', requireAuth, SettingsController.saveSettings);

// Module Management
router.get('/admin/modules', requireAuth, ModuleController.getModules);
router.post('/admin/modules', requireAuth, ModuleController.createModule);
router.post('/admin/modules/update/:id', requireAuth, ModuleController.updateModule);
router.delete('/admin/modules/:id', requireAuth, ModuleController.deleteModule);
router.post('/admin/modules/delete-bulk', requireAuth, ModuleController.deleteBulkModules);

// Category Management
router.get('/admin/categories', requireAuth, ModuleController.getCategories);
router.post('/admin/categories', requireAuth, ModuleController.createCategory);
router.post('/admin/categories/update/:id', requireAuth, ModuleController.updateCategory);
router.delete('/admin/categories/:id', requireAuth, ModuleController.deleteCategory);
router.post('/admin/categories/delete-bulk', requireAuth, ModuleController.deleteBulkCategories);

module.exports = router;
