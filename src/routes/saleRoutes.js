const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// POST /api/sales - Create a sale (Staff, Admin, Super Admin)
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), saleController.createSale);

// GET /api/sales - View sales (Admin sees all, Staff sees own)
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), saleController.getSales);

module.exports = router;