const pool = require('../config/db');

// Create stock adjustment (Admin only)
const createAdjustment = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { productId, quantityChange, reason } = req.body;
        const adminId = req.user.id;

        if (!productId || quantityChange === undefined || !reason) {
            return res.status(400).json({ error: 'productId, quantityChange, and a mandatory reason are required.' });
        }

        // Insert adjustment record
        await connection.query(
            `INSERT INTO stock_adjustments (product_id, admin_id, quantity_change, reason) 
             VALUES (?, ?, ?, ?)`,
            [productId, adminId, quantityChange, reason]
        );

        // Update product stock
        await connection.query(
            'UPDATE products SET current_stock = current_stock + ? WHERE id = ?',
            [quantityChange, productId]
        );

        await connection.commit();
        res.status(201).json({ message: 'Stock adjustment recorded successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error recording stock adjustment:', error);
        res.status(500).json({ error: 'Internal server error recording adjustment.' });
    } finally {
        connection.release();
    }
};

// Get adjustments (Admin only)
const getAdjustments = async (req, res) => {
    try {
        const [adjustments] = await pool.query(`
            SELECT sa.id, sa.quantity_change, sa.reason, sa.created_at,
                   p.id AS product_id, p.name AS product_name, p.unit,
                   u.full_name AS admin_name
            FROM stock_adjustments sa
            JOIN products p ON sa.product_id = p.id
            JOIN users u ON sa.admin_id = u.id
            ORDER BY sa.created_at DESC
        `);
        res.json(adjustments);
    } catch (error) {
        console.error('Error fetching adjustments:', error);
        res.status(500).json({ error: 'Internal server error fetching adjustments.' });
    }
};

module.exports = { createAdjustment, getAdjustments };