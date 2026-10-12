const express = require('express');
const router = express.Router();
const noteController = require('../controllers/noteController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// All authenticated roles (STAFF, ADMIN, SUPER_ADMIN) can create and view notes
router.post('/', authenticateToken, authorizeRoles('STAFF', 'ADMIN', 'SUPER_ADMIN'), noteController.createNote);
router.get('/', authenticateToken, authorizeRoles('STAFF', 'ADMIN', 'SUPER_ADMIN'), noteController.getNotes);

module.exports = router;
