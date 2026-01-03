const express = require('express');
const router = express.Router();
const SetupController = require('../controllers/SetupController');

router.get('/setup', SetupController.getSetup);
router.post('/setup', SetupController.postSetup);

module.exports = router;
