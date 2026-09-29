const pool = require('../config/db');

// Submit daily report (Staff)
const createDailyReport = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { dailySellsAmount, entries } = req.body; // entries: [{ bankId, amount }, ...]
        const staffId = req.user.id;

        if (dailySellsAmount === undefined || !entries || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'dailySellsAmount and split bank entries are required.' });
        }

        // Insert Header
        const [reportResult] = await connection.query(
            'INSERT INTO daily_reports (staff_id, daily_sells_amount) VALUES (?, ?)',
            [staffId, dailySellsAmount]
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
        res.status(201).json({ message: 'Daily report submitted successfully.', reportId });
    } catch (error) {
        await connection.rollback();
        console.error('Error submitting daily report:', error);
        res.status(400).json({ error: error.message || 'Internal server error submitting report.' });
    } finally {
        connection.release();
    }
};

// Get daily reports (Admin sees all, Staff sees own)
const getDailyReports = async (req, res) => {
    try {
        let query = `
            SELECT dr.id AS report_id, dr.daily_sells_amount, dr.created_at,
                   u.id AS staff_id, u.full_name AS staff_name,
                   dre.id AS entry_id, b.id AS bank_id, b.name AS bank_name, dre.amount
            FROM daily_reports dr
            JOIN users u ON dr.staff_id = u.id
            LEFT JOIN daily_report_entries dre ON dr.id = dre.daily_report_id
            LEFT JOIN banks b ON dre.bank_id = b.id
        `;
        let queryParams = [];

        if (req.user.role === 'STAFF') {
            query += ' WHERE dr.staff_id = ?';
            queryParams.push(req.user.id);
        }

        query += ' ORDER BY dr.created_at DESC';

        const [rows] = await pool.query(query, queryParams);

        // Group rows by report_id
        const reportsMap = {};
        rows.forEach(row => {
            if (!reportsMap[row.report_id]) {
                reportsMap[row.report_id] = {
                    reportId: row.report_id,
                    dailySellsAmount: row.daily_sells_amount,
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
        console.error('Error fetching daily reports:', error);
        res.status(500).json({ error: 'Internal server error fetching daily reports.' });
    }
};

module.exports = { createDailyReport, getDailyReports };