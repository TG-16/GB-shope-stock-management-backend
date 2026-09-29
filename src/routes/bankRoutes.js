const express = require('express');
const router = express.Router();
const bankController = require('../controllers/bankController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), bankController.getBanks);
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN'), bankController.createBank);

module.exports = router;