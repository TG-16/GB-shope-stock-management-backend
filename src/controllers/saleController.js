const pool = require('../config/db');

// Create a new sale (Accessible by Staff and Admin)
const createSale = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const staffId = req.user.id; // From JWT payload
        const { items } = req.body; // Expected format: [{ productId: 1, quantity: 2, sellingPrice: 45 }, ...]

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'A sale must contain at least one item.' });
        }

        // 1. Insert into sales table (Header)
        const [saleResult] = await connection.query(
            'INSERT INTO sales (staff_id, status) VALUES (?, ?)',
            [staffId, 'ACTIVE']
        );
        const saleId = saleResult.insertId;

        // 2. Process each sale item
        for (const item of items) {
            const { productId, quantity, sellingPrice } = item;

            if (!productId || quantity === undefined || sellingPrice === undefined || quantity <= 0 || sellingPrice < 0) {
                throw new Error('Invalid product ID, quantity, or selling price in sale items.');
            }

            // Check product existence and current stock & purchase price
            const [productRows] = await connection.query(
                'SELECT current_stock, purchase_price FROM products WHERE id = ? FOR UPDATE',
                [productId]
            );

            if (productRows.length === 0) {
                throw new Error(`Product with ID ${productId} not found.`);
            }

            const product = productRows.real || productRows[0];
            const currentStock = Number(product.current_stock);
            const purchasePrice = Number(product.purchase_price);

            if (currentStock < Number(quantity)) {
                throw new Error(`Insufficient stock for product ID ${productId}. Available: ${currentStock}, Requested: ${quantity}`);
            }

            // Insert into sale_items capturing historical purchase price for profit calculation
            await connection.query(
                `INSERT INTO sale_items (sale_id, product_id, quantity, selling_price, historical_purchase_price) 
                 VALUES (?, ?, ?, ?, ?)`,
                [saleId, productId, quantity, sellingPrice, purchasePrice]
            );

            // Deduct stock from products table
            await connection.query(
                'UPDATE products SET current_stock = current_stock - ? WHERE id = ?',
                [quantity, productId]
            );
        }

        await connection.commit();
        res.status(201).json({
            message: 'Sale recorded successfully and stock updated.',
            saleId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error creating sale:', error.message);
        res.status(400).json({ error: error.message || 'Internal server error while recording sale.' });
    } finally {
        connection.release();
    }
};

// Get all sales (Admin sees all, Staff can see their own or all depending on rules, but let's allow Admin full view and staff relevant view)
const getSales = async (req, res) => {
    try {
        let query = `
            SELECT s.id AS sale_id, s.status, s.created_at, 
                   u.id AS staff_id, u.full_name AS staff_name,
                   si.id AS item_id, si.product_id, p.name AS product_name, 
                   si.quantity, si.selling_price, si.historical_purchase_price, p.unit
            FROM sales s
            JOIN users u ON s.staff_id = u.id
            JOIN sale_items si ON s.id = si.sale_id
            JOIN products p ON si.product_id = p.id
        `;

        let queryParams = [];

        // If user is staff, restrict to their own sales
        if (req.user.role === 'STAFF') {
            query += ' WHERE s.staff_id = ?';
            queryParams.push(req.user.id);
        }

        query += ' ORDER BY s.created_at DESC';

        const [rows] = await pool.query(query, queryParams);

        // Group rows by sale_id so each sale contains an array of items
        const salesMap = {};
        rows.forEach(row => {
            if (!salesMap[row.sale_id]) {
                salesMap[row.sale_id] = {
                    saleId: row.sale_id,
                    status: row.status,
                    createdAt: row.created_at,
                    staff: {
                        id: row.staff_id,
                        fullName: row.staff_name
                    },
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

module.exports = {
    createSale,
    getSales
};