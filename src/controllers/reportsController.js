const pool = require('../config/db');

// Get financial reports with shortcut options (daily, weekly, monthly) or custom date range (from, to)
const getReportSummary = async (req, res) => {
    try {
        const { period, from, to } = req.query; // period can be 'daily', 'weekly', 'monthly', or custom 'from'/'to'
        // Frontend sends period as 'today', 'week', 'month' or 'custom'
        
        let startDate, endDate;
        const today = new Date().toISOString().split('T')[0];

        if (period === 'today' || period === 'daily') {
            startDate = today;
            endDate = today;
        } else if (period === 'week' || period === 'weekly') {
            const d = new Date();
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString().split('T')[0];
            endDate = today;
        } else if (period === 'month' || period === 'monthly') {
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
            WHERE DATE(created_at) BETWEEN ? AND ?
        `, [startDate, endDate]);

        // 3. Daily grouping for chart data
        const [chartDataRows] = await pool.query(`
            SELECT 
                DATE(s.created_at) as date,
                COALESCE(SUM(si.quantity * si.selling_price), 0) AS revenue,
                COALESCE(SUM(si.quantity * (si.selling_price - si.historical_purchase_price)), 0) AS profit
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.status = 'ACTIVE' AND DATE(s.created_at) BETWEEN ? AND ?
            GROUP BY DATE(s.created_at)
            ORDER BY DATE(s.created_at) ASC
        `, [startDate, endDate]);

        const chartData = chartDataRows.map(row => ({
            date: row.date.toISOString().split('T')[0],
            revenue: Number(row.revenue),
            profit: Number(row.profit)
        }));

        const totalRevenue = Number(salesStats[0].total_revenue);
        const totalProfit = Number(salesStats[0].total_profit);
        const totalExpenses = Number(expenseStats[0].total_expenses);
        const netProfit = totalProfit - totalExpenses;

        res.json({
            period: period || 'custom',
            dateRange: { startDate, endDate },
            totalRevenue,
            totalProfit,
            totalExpenses,
            netProfit,
            chartData
        });

    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Internal server error generating report.' });
    }
};


// Get admin dashboard quick stats and notification badge counts
const getDashboardStats = async (req, res) => {
    try {
        // 1. Total products count
        const [productRows] = await pool.query('SELECT COUNT(*) AS totalProducts FROM products');
        
        // 2. Pending purchase requests count (for notification badge)
        const [purchaseRows] = await pool.query('SELECT COUNT(*) AS pendingPurchases FROM purchases WHERE status = "PENDING"');
        
        // 3. Pending credit payment requests count (for notification badge)
        const [creditRows] = await pool.query('SELECT COUNT(DISTINCT sale_id) AS pendingCreditPayments FROM credit_payment_requests WHERE status = "PENDING"');
        
        // 4. Today's total sales and total profit summary
        const [salesRows] = await pool.query(`
            SELECT 
                COALESCE(SUM(si.quantity * si.selling_price), 0) AS todaySales,
                COALESCE(SUM(si.quantity * (si.selling_price - si.historical_purchase_price)), 0) AS todayProfit
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.status = 'ACTIVE' AND DATE(s.created_at) = CURDATE()
        `);

        res.json({
            totalProducts: productRows[0].totalProducts,
            pendingPurchases: purchaseRows[0].pendingPurchases,
            pendingCreditPayments: creditRows[0].pendingCreditPayments,
            todaySales: Number(salesRows[0].todaySales),
            todayProfit: Number(salesRows[0].todayProfit)
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: 'Internal server error fetching dashboard statistics.' });
    }
};




module.exports = {
    getReportSummary,
    getDashboardStats
};