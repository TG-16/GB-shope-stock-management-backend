const express = require('express');
const router = express.Router();
const adjustmentController = require('../controllers/adjustmentController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), adjustmentController.createAdjustment);
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), adjustmentController.getAdjustments);

module.exports = router;