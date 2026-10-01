const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// --- 1. CORE SALES ENDPOINTS ---

// POST /api/sales - Create a sale or credit sale (Staff, Admin, Super Admin)
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), saleController.createSale);

// GET /api/sales - View sales with filters (Admin sees all, Staff sees own)
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), saleController.getSales);


// --- 2. CREDIT PAYMENT REQUEST WORKFLOW ---

// POST /api/sales/credit-requests - Staff submits request when a credit sale is paid
router.post('/credit-requests', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), saleController.requestCreditPayment);

// GET /api/sales/credit-requests - Admin views pending credit payoff requests
router.get('/credit-requests', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), saleController.getCreditPaymentRequests);

// PUT /api/sales/credit-requests/:requestId/approve - Admin approves credit payoff
router.put('/credit-requests/:requestId/approve', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), saleController.approveCreditPaymentRequest);

// PUT /api/sales/credit-requests/:requestId/reject - Admin rejects credit payoff
router.put('/credit-requests/:requestId/reject', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), saleController.rejectCreditPaymentRequest);

module.exports = router;