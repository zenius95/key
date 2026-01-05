const express = require('express');
const router = express.Router();
const ModuleController = require('../controllers/ModuleController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Get all modules and categories (Protected)
router.get('/modules', requireAuth, ModuleController.getAllModulesAPI);

module.exports = router;
