const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), staffController.registerStaff);
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), staffController.getAllStaff);
router.patch('/:id/status', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), staffController.updateStaffStatus);

module.exports = router;