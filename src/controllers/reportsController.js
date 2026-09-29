const pool = require('../config/db');

// Get financial reports with shortcut options (daily, weekly, monthly) or custom date range (from, to)
const getReportSummary = async (req, res) => {
    try {
        const { period, from, to } = req.query; // period can be 'daily', 'weekly', 'monthly', or custom 'from'/'to'

        let startDate, endDate;
        const today = new Date().toISOString().split('T')[0];

        if (period === 'daily') {
            startDate = today;
            endDate = today;
        } else if (period === 'weekly') {
            // Last 7 days
            const d = new Date();
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString().split('T')[0];
            endDate = today;
        } else if (period === 'monthly') {
            // Last 30 days
            const d = new Date();
            d.setDate(d.getDate() - 30);
            startDate = d.toISOString().split('T')[0];
            endDate = today;
        } else if (from && to) {
            startDate = from;
            endDate = to;
        } else {
            startDate = today;
            endDate = today;
        }

        // 1. Calculate Revenue & Profit from ACTIVE sales within range
        const [salesStats] = await pool.query(`
            SELECT 
                COALESCE(SUM(si.quantity * si.selling_price), 0) AS total_revenue,
                COALESCE(SUM(si.quantity * (si.selling_price - si.historical_purchase_price)), 0) AS total_profit
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.status = 'ACTIVE' AND DATE(s.created_at) BETWEEN ? AND ?
        `, [startDate, endDate]);

        // 2. Calculate Total Expenses within range
        const [expenseStats] = await pool.query(`
            SELECT COALESCE(SUM(amount), 0) AS total_expenses
            FROM daily_expenses
            WHERE expense_date BETWEEN ? AND ?
        `, [startDate, endDate]);

        // 3. Outstanding Credit Sales total
        const [creditStats] = await pool.query(`
            SELECT COALESCE(SUM(si.quantity * si.selling_price), 0) AS total_credit
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.status = 'CREDIT' AND DATE(s.created_at) BETWEEN ? AND ?
        `, [startDate, endDate]);

        res.json({
            period: period || 'custom',
            dateRange: { startDate, endDate },
            revenue: Number(salesStats[0].total_revenue),
            profit: Number(salesStats[0].total_profit),
            expenses: Number(expenseStats[0].total_expenses),
            outstandingCredit: Number(creditStats[0].total_credit)
        });

    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Internal server error generating report.' });
    }
};

module.exports = {
    getReportSummary
};