const express = require('express');
const router = express.Router();
const voidController = require('../controllers/voidController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// --- VOID WORKFLOW ROUTES ---

// POST /api/voids/requests - Staff submits a void request (full or partial)
router.post('/requests', authenticateToken, authorizeRoles('STAFF', 'ADMIN', 'SUPER_ADMIN'), voidController.requestVoid);

// GET /api/voids/requests - Admin views pending void requests
router.get('/requests', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), voidController.getVoidRequests);

// PUT /api/voids/requests/:requestId/approve - Admin approves void request
router.put('/requests/:requestId/approve', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), voidController.approveVoidRequest);

// PUT /api/voids/requests/:requestId/reject - Admin rejects void request
router.put('/requests/:requestId/reject', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), voidController.rejectVoidRequest);

// PUT /api/voids/direct/:saleId - Staff direct void (own sale, same-day only)
router.put('/direct/:saleId', authenticateToken, authorizeRoles('STAFF', 'ADMIN', 'SUPER_ADMIN'), voidController.staffDirectVoid);

// PUT /api/voids/admin-direct/:saleId - Admin direct void (any sale, any date, full or item-level)
router.put('/admin-direct/:saleId', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), voidController.adminDirectVoid);

module.exports = router;
