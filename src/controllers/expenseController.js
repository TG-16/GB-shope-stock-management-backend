const pool = require('../config/db');

// Register daily expense (Staff & Admin)
const createExpense = async (req, res) => {
    try {
        const { reason, amount } = req.body;
        const staffId = req.user.id;

        if (!reason || amount === undefined) {
            return res.status(400).json({ error: 'Reason and amount are required.' });
        }

        const [result] = await pool.query(
            'INSERT INTO daily_expenses (staff_id, reason, amount) VALUES (?, ?, ?)',
            [staffId, reason, amount]
        );

        res.status(201).json({ message: 'Expense recorded successfully', expenseId: result.insertId });
    } catch (error) {
        console.error('Error recording expense:', error);
        res.status(500).json({ error: 'Internal server error recording expense.' });
    }
};

// Get expenses (filterable by date range)
const getExpenses = async (req, res) => {
    try {
        const { from, to } = req.query;
        let query = `
            SELECT e.id, e.reason, e.amount, e.created_at, 
                   u.id AS staff_id, u.full_name AS staff_name
            FROM daily_expenses e
            JOIN users u ON e.staff_id = u.id
        `;
        let queryParams = [];

        if (from && to) {
            query += ' WHERE DATE(e.created_at) BETWEEN ? AND ?';
            queryParams.push(from, to);
        }

        query += ' ORDER BY e.created_at DESC';

        const [expenses] = await pool.query(query, queryParams);
        res.json(expenses);
    } catch (error) {
        console.error('Error fetching expenses:', error);
        res.status(500).json({ error: 'Internal server error fetching expenses.' });
    }
};

module.exports = {
    createExpense,
    getExpenses
};