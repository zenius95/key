const express = require('express');
const router = express.Router();
const CronController = require('../controllers/CronController');

router.get('/cron/check-transactions', CronController.checkTransactions);

module.exports = router;
