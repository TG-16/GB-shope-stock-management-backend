const express = require('express');
const router = express.Router();
const dailyReportController = require('../controllers/dailyReportController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), dailyReportController.createDailyReport);
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), dailyReportController.getDailyReports);

module.exports = router;