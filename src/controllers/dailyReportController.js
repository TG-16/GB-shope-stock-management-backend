const pool = require('../config/db');

// --- 1. PREVIEW TODAY'S SALES & PROFIT ---
const getTodayDailyReportPreview = async (req, res) => {
    try {
        const staffId = req.user.role === 'STAFF' ? req.user.id : null;

        let salesQuery = `
            SELECT s.id AS sale_id, s.created_at,
                   si.id AS item_id, si.quantity, si.selling_price, si.historical_purchase_price,
                   p.name AS product_name
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            JOIN products p ON si.product_id = p.id
            WHERE s.status = 'ACTIVE' AND DATE(s.created_at) = CURDATE()
        `;
        let queryParams = [];

        // if (staffId) {
        //     salesQuery += ' AND s.staff_id = ?';
        //     queryParams.push(staffId);
        // }

        salesQuery += ' ORDER BY s.created_at DESC';

        const [rows] = await pool.query(salesQuery, queryParams);

        const salesMap = {};
        let totalSalesAmount = 0;
        let totalProfit = 0;

        rows.forEach(row => {
            if (!salesMap[row.sale_id]) {
                salesMap[row.sale_id] = {
                    saleId: row.sale_id,
                    createdAt: row.created_at,
                    items: [],
                    saleTotal: 0,
                    saleProfit: 0
                };
            }

            const itemTotal = Number(row.quantity) * Number(row.selling_price);
            const itemCost = Number(row.quantity) * Number(row.historical_purchase_price);
            const itemProfit = itemTotal - itemCost;

            salesMap[row.sale_id].items.push({
                productName: row.product_name,
                quantity: row.quantity,
                sellingPrice: row.selling_price,
                total: itemTotal
            });

            salesMap[row.sale_id].saleTotal += itemTotal;
            salesMap[row.sale_id].saleProfit += itemProfit;

            totalSalesAmount += itemTotal;
            totalProfit += itemProfit;
        });

        const [banks] = await pool.query('SELECT id, name FROM banks ORDER BY name ASC');

        res.json({
            date: new Date().toISOString().split('T')[0],
            totalSalesAmount,
            totalProfit,
            salesList: Object.values(salesMap),
            availableBanks: banks
        });
    } catch (error) {
        console.error('Error generating daily report preview:', error);
        res.status(500).json({ error: 'Internal server error generating daily report preview.' });
    }
};

// --- 2. SUBMIT TODAY'S DAILY REPORT ---
const createDailyReport = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { entries } = req.body;
        const staffId = req.user.id;

        if (!entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'Split bank entries are required.' });
        }

        // Backend securely calculates totals from database records
        const [salesRows] = await connection.query(`
            SELECT si.quantity, si.selling_price, si.historical_purchase_price
            FROM sales s
            JOIN sale_items si ON s.id = si.sale_id
            WHERE s.staff_id = ? AND s.status = 'ACTIVE' AND DATE(s.created_at) = CURDATE()
        `, [staffId]);

        let computedSalesAmount = 0;
        let computedTotalProfit = 0;

        salesRows.forEach(item => {
            const itemTotal = Number(item.quantity) * Number(item.selling_price);
            const itemCost = Number(item.quantity) * Number(item.historical_purchase_price);
            computedSalesAmount += itemTotal;
            computedTotalProfit += (itemTotal - itemCost);
        });

        // Insert Header without report_date (relying on created_at timestamp default)
        const [reportResult] = await connection.query(
            `INSERT INTO daily_reports (staff_id, daily_sells_amount, daily_total_profit) 
             VALUES (?, ?, ?)`,
            [staffId, computedSalesAmount, computedTotalProfit]
        );
        const reportId = reportResult.insertId;

        // Insert Split Bank Entries
        for (const entry of entries) {
            if (!entry.bankId || entry.amount === undefined) {
                throw new Error('Each bank entry requires bankId and amount.');
            }
            await connection.query(
                'INSERT INTO daily_report_entries (daily_report_id, bank_id, amount) VALUES (?, ?, ?)',
                [reportId, entry.bankId, entry.amount]
            );
        }

        await connection.commit();
        res.status(201).json({ 
            message: 'Daily report submitted successfully.', 
            reportId,
            recordedSales: computedSalesAmount,
            recordedProfit: computedTotalProfit
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error submitting daily report:', error);
        res.status(400).json({ error: error.message || 'Internal server error submitting daily report.' });
    } finally {
        connection.release();
    }
};

// --- 3. VIEW TODAY'S DAILY REPORTS ---
const getTodayDailyReports = async (req, res) => {
    try {
        let query = `
            SELECT dr.id AS report_id, dr.daily_sells_amount, dr.daily_total_profit, dr.created_at,
                   u.id AS staff_id, u.full_name AS staff_name,
                   dre.id AS entry_id, b.id AS bank_id, b.name AS bank_name, dre.amount
            FROM daily_reports dr
            JOIN users u ON dr.staff_id = u.id
            LEFT JOIN daily_report_entries dre ON dr.id = dre.daily_report_id
            LEFT JOIN banks b ON dre.bank_id = b.id
            WHERE DATE(dr.created_at) = CURDATE()
        `;
        let queryParams = [];

        if (req.user.role === 'STAFF') {
            query += ' AND dr.staff_id = ?';
            queryParams.push(req.user.id);
        }

        query += ' ORDER BY dr.created_at DESC';

        const [rows] = await pool.query(query, queryParams);

        const reportsMap = {};
        rows.forEach(row => {
            if (!reportsMap[row.report_id]) {
                reportsMap[row.report_id] = {
                    reportId: row.report_id,
                    dailySellsAmount: row.daily_sells_amount,
                    dailyTotalProfit: row.daily_total_profit,
                    createdAt: row.created_at,
                    staff: { id: row.staff_id, fullName: row.staff_name },
                    bankEntries: []
                };
            }
            if (row.entry_id) {
                reportsMap[row.report_id].bankEntries.push({
                    entryId: row.entry_id,
                    bankId: row.bank_id,
                    bankName: row.bank_name,
                    amount: row.amount
                });
            }
        });

        res.json(Object.values(reportsMap));
    } catch (error) {
        console.error('Error fetching today daily reports:', error);
        res.status(500).json({ error: 'Internal server error fetching today daily reports.' });
    }
};

module.exports = {
    getTodayDailyReportPreview,
    createDailyReport,
    getTodayDailyReports
};