const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { checkSetup } = require('../middlewares/authMiddleware');

router.get('/login', checkSetup, AuthController.getLogin);
router.post('/login', AuthController.postLogin);
router.get('/logout', AuthController.logout);

module.exports = router;
