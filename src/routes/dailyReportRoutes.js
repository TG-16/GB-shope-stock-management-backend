const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// GET /api/daily-reports/preview - Step 1: Preview today's sales, totals, profits, and banks
router.get('/preview', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), dailyReportController.getTodayDailyReportPreview);

// POST /api/daily-reports - Step 2: Submit today's daily report with backend-calculated totals and bank splits
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), dailyReportController.createDailyReport);

// GET /api/daily-reports - Step 3: View today's submitted daily reports
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), dailyReportController.getTodayDailyReports);

module.exports = router;