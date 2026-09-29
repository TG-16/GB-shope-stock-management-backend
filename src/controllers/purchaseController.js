const pool = require('../config/db');

// Create purchase request (Staff, Admin)
const createPurchaseRequest = async (req, res) => {
    try {
        const { productId, quantity, purchasePrice } = req.body;
        const staffId = req.user.id;

        if (!productId || quantity === undefined || purchasePrice === undefined || quantity <= 0 || purchasePrice < 0) {
            return res.status(400).json({ error: 'Valid productId, quantity, and purchasePrice are required.' });
        }

        const [result] = await pool.query(
            `INSERT INTO purchases (product_id, staff_id, quantity, purchase_price, status) 
             VALUES (?, ?, ?, ?, 'PENDING')`,
            [productId, staffId, quantity, purchasePrice]
        );

        res.status(201).json({ message: 'Purchase request submitted successfully.', purchaseId: result.insertId });
    } catch (error) {
        console.error('Error creating purchase request:', error);
        res.status(500).json({ error: 'Internal server error creating purchase request.' });
    }
};

// Get purchases (Admin sees all, Staff sees relevant)
const getPurchases = async (req, res) => {
    try {
        let query = `
            SELECT pr.id, pr.quantity, pr.purchase_price, pr.status, pr.created_at,
                   p.id AS product_id, p.name AS product_name, p.unit,
                   u.id AS staff_id, u.full_name AS staff_name
            FROM purchases pr
            JOIN products p ON pr.product_id = p.id
            JOIN users u ON pr.staff_id = u.id
        `;
        let queryParams = [];

        if (req.user.role === 'STAFF') {
            query += ' WHERE pr.staff_id = ?';
            queryParams.push(req.user.id);
        }

        query += ' ORDER BY pr.created_at DESC';

        const [purchases] = await pool.query(query, queryParams);
        res.json(purchases);
    } catch (error) {
        console.error('Error fetching purchases:', error);
        res.status(500).json({ error: 'Internal server error fetching purchases.' });
    }
};

// Approve or Reject purchase request (Admin only)
const reviewPurchase = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;
        const { status } = req.body; // 'APPROVED' or 'REJECTED'

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED.' });
        }

        const [purchaseRows] = await connection.query('SELECT * FROM purchases WHERE id = ? AND status = "PENDING"', [id]);
        if (purchaseRows.length === 0) {
            return res.status(404).json({ error: 'Pending purchase request not found.' });
        }

        const purchase = purchaseRows[0];

        // Update purchase status
        await connection.query('UPDATE purchases SET status = ? WHERE id = ?', [status, id]);

        // If approved, increase product stock and update current purchase price
        if (status === 'APPROVED') {
            await connection.query(
                'UPDATE products SET current_stock = current_stock + ?, purchase_price = ? WHERE id = ?',
                [purchase.quantity, purchase.purchase_price, purchase.product_id]
            );
        }

        await connection.commit();
        res.json({ message: `Purchase request ${status.toLowerCase()} successfully.` });
    } catch (error) {
        await connection.rollback();
        console.error('Error reviewing purchase:', error);
        res.status(500).json({ error: 'Internal server error reviewing purchase.' });
    } finally {
        connection.release();
    }
};

module.exports = { createPurchaseRequest, getPurchases, reviewPurchase };