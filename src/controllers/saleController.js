const pool = require('../config/db');

// Create Sale or Credit Sale
const createSale = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const staffId = req.user.id;
        const { items, isCredit } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'A sale must contain at least one item.' });
        }

        const saleStatus = isCredit ? 'CREDIT' : 'ACTIVE';

        const [saleResult] = await connection.query(
            'INSERT INTO sales (staff_id, status) VALUES (?, ?)',
            [staffId, saleStatus]
        );
        const saleId = saleResult.insertId;

        for (const item of items) {
            const { productId, quantity, sellingPrice } = item;

            const [productRows] = await connection.query(
                'SELECT current_stock, purchase_price FROM products WHERE id = ? FOR UPDATE',
                [productId]
            );

            if (productRows.length === 0) {
                throw new Error(`Product ID ${productId} not found.`);
            }

            const product = productRows[0];
            if (Number(product.current_stock) < Number(quantity)) {
                throw new Error(`Insufficient stock for product ID ${productId}.`);
            }

            await connection.query(
                `INSERT INTO sale_items (sale_id, product_id, quantity, selling_price, historical_purchase_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [saleId, productId, quantity, sellingPrice, product.purchase_price]
            );

            await connection.query(
                'UPDATE products SET current_stock = current_stock - ? WHERE id = ?',
                [quantity, productId]
            );
        }

        await connection.commit();
        res.status(201).json({
            message: isCredit ? 'Credit sale recorded successfully.' : 'Sale recorded successfully.',
            saleId
        });

    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message || 'Internal server error recording sale.' });
    } finally {
        connection.release();
    }
};

// Get Sales with filters
const getSales = async (req, res) => {
    try {
        const { from, to, productId, status } = req.query;
        
        let query = `
            SELECT s.id AS sale_id, s.status, s.created_at, 
                   u.id AS staff_id, u.full_name AS staff_name,
                   si.id AS item_id, si.product_id, p.name AS product_name, 
                   si.quantity, si.selling_price, si.historical_purchase_price, p.unit
            FROM sales s
            JOIN users u ON s.staff_id = u.id
            JOIN sale_items si ON s.id = si.sale_id
            JOIN products p ON si.product_id = p.id
            WHERE 1=1
        `;
        let queryParams = [];

        if (status) {
            query += ' AND s.status = ?';
            queryParams.push(status);
        } else {
            query += ' AND s.status = "ACTIVE"';
        }

        if (req.user.role === 'STAFF') {
            query += ' AND s.staff_id = ?';
            queryParams.push(req.user.id);
        }

        if (from && to) {
            query += ' AND DATE(s.created_at) BETWEEN ? AND ?';
            queryParams.push(from, to);
        }

        if (productId) {
            query += ' AND si.product_id = ?';
            queryParams.push(productId);
        }

        query += ' ORDER BY s.created_at DESC';

        const [rows] = await pool.query(query, queryParams);

        const salesMap = {};
        rows.forEach(row => {
            if (!salesMap[row.sale_id]) {
                salesMap[row.sale_id] = {
                    saleId: row.sale_id,
                    status: row.status,
                    createdAt: row.created_at,
                    staff: { id: row.staff_id, fullName: row.staff_name },
                    items: []
                };
            }
            salesMap[row.sale_id].items.push({
                itemId: row.item_id,
                productId: row.product_id,
                productName: row.product_name,
                quantity: row.quantity,
                sellingPrice: row.selling_price,
                historicalPurchasePrice: row.historical_purchase_price,
                unit: row.unit
            });
        });

        res.json(Object.values(salesMap));
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Internal server error while fetching sales.' });
    }
};

// --- STEP 1: Staff requests approval for a credit payoff ---
const requestCreditPayment = async (req, res) => {
    try {
        const { saleId } = req.body;
        const staffId = req.user.id;

        // Verify the sale is an outstanding credit sale
        const [saleRows] = await pool.query('SELECT id, status FROM sales WHERE id = ? AND status = "CREDIT"', [saleId]);
        if (saleRows.length === 0) {
            return res.status(404).json({ error: 'Credit sale not found or is not currently in CREDIT status.' });
        }

        // Insert request
        const [result] = await pool.query(
            'INSERT INTO credit_payment_requests (sale_id, staff_id, status) VALUES (?, ?, "PENDING")',
            [saleId, staffId]
        );

        res.status(201).json({ message: 'Credit payment request submitted to admin.', requestId: result.insertId });
    } catch (error) {
        console.error('Error requesting credit payment:', error);
        res.status(500).json({ error: 'Internal server error requesting credit payment.' });
    }
};

// --- STEP 2: Admin approves the credit payoff request ---
const approveCreditPaymentRequest = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { requestId } = req.params;

        // Fetch request
        const [reqRows] = await connection.query('SELECT * FROM credit_payment_requests WHERE id = ? AND status = "PENDING"', [requestId]);
        if (reqRows.length === 0) {
            return res.status(404).json({ error: 'Pending credit payment request not found.' });
        }

        const request = reqRows[0];

        // Mark request as APPROVED
        await connection.query('UPDATE credit_payment_requests SET status = "APPROVED" WHERE id = ?', [requestId]);

        // Mark original credit sale as CREDIT_PAID
        await connection.query('UPDATE sales SET status = "CREDIT_PAID" WHERE id = ?', [request.sale_id]);

        // Fetch items from the original credit sale
        const [items] = await connection.query('SELECT product_id, quantity, selling_price, historical_purchase_price FROM sale_items WHERE sale_id = ?', [request.sale_id]);

        // Create a new ACTIVE sale record for today so it counts towards today's revenue and profit
        const [newSale] = await connection.query('INSERT INTO sales (staff_id, status) VALUES (?, "ACTIVE")', [req.user.id]);
        const newSaleId = newSale.insertId;

        for (const item of items) {
            await connection.query(
                `INSERT INTO sale_items (sale_id, product_id, quantity, selling_price, historical_purchase_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [newSaleId, item.product_id, item.quantity, item.selling_price, item.historical_purchase_price]
            );
        }

        await connection.commit();
        res.json({ message: 'Credit payment approved. Sale revenue has been logged for today.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error approving credit payment:', error);
        res.status(500).json({ error: 'Internal server error approving credit payment.' });
    } finally {
        connection.release();
    }
};

// Get pending credit payment requests for admin review
const getCreditPaymentRequests = async (req, res) => {
    try {
        const [requests] = await pool.query(`
            -r
            SELECT cpr.id AS request_id, cpr.status, cpr.created_at,
                   s.id AS sale_id, u.full_name AS staff_name
            FROM credit_payment_requests cpr
            JOIN sales s ON cpr.sale_id = s.id
            JOIN users u ON cpr.staff_id = u.id
            WHERE cpr.status = 'PENDING'
            ORDER BY cpr.created_at DESC
        `);
        res.json(requests);
    } catch (error) {
        console.error('Error fetching credit payment requests:', error);
        res.status(500).json({ error: 'Internal server error fetching requests.' });
    }
};

module.exports = {
    createSale,
    getSales,
    requestCreditPayment,
    approveCreditPaymentRequest,
    getCreditPaymentRequests
};