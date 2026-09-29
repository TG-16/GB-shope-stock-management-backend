const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), purchaseController.createPurchaseRequest);
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), purchaseController.getPurchases);
router.put('/:id/review', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), purchaseController.reviewPurchase);

module.exports = router;