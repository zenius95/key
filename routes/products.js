const express = require('express');
const router = express.Router();
const ProductController = require('../controllers/ProductController');
const { requireAuth } = require('../middlewares/authMiddleware');

router.get('/admin/products', requireAuth, ProductController.listProducts);
router.post('/products/save', requireAuth, ProductController.saveProduct);
router.get('/products/delete/:id', requireAuth, ProductController.deleteProduct);

module.exports = router;
