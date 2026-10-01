const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/superAdminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Enforce strict SUPER_ADMIN security middleware on all routes in this file
router.use(authenticateToken, authorizeRoles('SUPER_ADMIN'));

// User Management Endpoints
router.post('/users', superAdminController.registerUser);          // Register Admin or Staff
router.get('/users', superAdminController.getAllUsers);            // List all users
router.put('/users/:id', superAdminController.updateUser);         // Edit user details / role
router.put('/users/:id/password', superAdminController.changeUserPassword); // Reset user password
router.delete('/users/:id', superAdminController.deleteUser);      // Delete  user account

// Global Master Overrides
router.delete('/sales/:saleId', superAdminController.forceDeleteSale); // Force delete sale and restore stock

module.exports = router;