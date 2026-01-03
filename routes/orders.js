const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.get('/admin/orders', requireAuth, OrderController.listOrders);
router.post('/orders/create', requireAuth, OrderController.createOrder);
router.post('/orders/update', requireAuth, OrderController.updateOrder);
router.get('/orders/delete/:id', requireAuth, OrderController.deleteOrder);
router.post('/orders/delete-bulk', requireAuth, OrderController.bulkDeleteOrders);

module.exports = router;
