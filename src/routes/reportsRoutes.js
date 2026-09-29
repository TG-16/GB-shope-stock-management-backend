const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/reports/summary - Admin-only financial report summary
router.get('/summary', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), reportController.getReportSummary);

module.exports = router;