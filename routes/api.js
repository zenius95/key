const express = require('express');
const router = express.Router();
const ModuleController = require('../controllers/ModuleController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Get all modules and categories (Protected)
router.get('/modules', requireAuth, ModuleController.getAllModulesAPI);

// Get Client Script (Protected & Encrypted)
router.get('/module/:id', requireAuth, ModuleController.getClientScript);

module.exports = router;
