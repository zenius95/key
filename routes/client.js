const express = require('express');
const router = express.Router();
const ClientController = require('../controllers/ClientController');
const { requireAuth } = require('../middlewares/authMiddleware');

// Middleware to ensure user is NOT admin (optional, but good for separation)
// For now, we just requireAuth. Admins can access client area if they want? 
// Or strict separation: if (req.session.role !== 'user') return res.redirect('/admin');
// Let's keep it simple: requireAuth.

// Routes
router.get('/', requireAuth, ClientController.dashboard);
router.get('/profile', requireAuth, ClientController.profile);
router.post('/profile', requireAuth, ClientController.updateProfile);

module.exports = router;
