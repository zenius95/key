const express = require('express');
const router = express.Router();
const UserController = require('../controllers/UserController');
const { requireAuth } = require('../middlewares/authMiddleware');

// User Management
router.get('/admin/users', requireAuth, UserController.listUsers);
router.post('/users/update', requireAuth, UserController.updateUser);
router.post('/users/delete-bulk', requireAuth, UserController.bulkDeleteUsers);
router.get('/users/delete/:id', requireAuth, UserController.deleteUser);
router.post('/admin/users/:id/balance', requireAuth, UserController.updateBalance);

module.exports = router;
