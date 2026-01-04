const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { checkSetup, requireAuth } = require('../middlewares/authMiddleware');


router.get('/login', AuthController.getLogin);
router.post('/login', AuthController.postLogin);
router.get('/logout', AuthController.logout);
router.get('/api/check', requireAuth, AuthController.checkLicense);
router.get('/api/me', requireAuth, AuthController.getUserInfo);

module.exports = router;
