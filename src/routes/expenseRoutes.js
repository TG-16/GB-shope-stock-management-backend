const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// POST /api/expenses - Register a daily expense (Staff, Admin)
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), expenseController.createExpense);

// GET /api/expenses - View daily expenses with date range filters (Admin, Staff)
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'SUPER_ADMIN', 'STAFF'), expenseController.getExpenses);

module.exports = router;