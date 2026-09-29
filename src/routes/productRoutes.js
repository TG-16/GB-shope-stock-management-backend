const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/products - View stock list (Admin and Staff)
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), productController.getAllProducts);

// POST /api/products - Add a new product (Admin and Staff can now create)
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), productController.createProduct);

// PUT /api/products/:id - Edit product info (Admin only)
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), productController.updateProduct);

module.exports = router;