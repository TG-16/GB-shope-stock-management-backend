const pool = require('../config/db');

// Get all products (Accessible by Admin and Staff)
const getAllProducts = async (req, res) => {
    try {
        const [products] = await pool.query(
            'SELECT id, name, category, purchase_price, current_stock, minimum_stock, unit, created_at, updated_at FROM products ORDER BY name ASC'
        );
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error while fetching products.' });
    }
};

// Create a new product (Accessible by Admin and Staff)
const createProduct = async (req, res) => {
    try {
        const { name, category, purchase_price, initial_stock, minimum_stock, unit } = req.body;

        if (!name || !category || purchase_price === undefined || initial_stock === undefined || minimum_stock === undefined) {
            return res.status(400).json({ error: 'All required product fields (name, category, purchase_price, initial_stock, minimum_stock) must be provided.' });
        }

        // Validate unit if provided, default to 'pce' if not
        const productUnit = unit && ['pce', 'meter'].includes(unit) ? unit : 'pce';

        const [result] = await pool.query(
            `INSERT INTO products (name, category, purchase_price, current_stock, minimum_stock, unit) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, category, purchase_price, initial_stock, minimum_stock, productUnit]
        );

        res.status(201).json({
            message: 'Product created successfully',
            productId: result.insertId,
            product: {
                id: result.insertId,
                name,
                category,
                purchase_price,
                current_stock: initial_stock,
                minimum_stock,
                unit: productUnit
            }
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Internal server error while creating product.' });
    }
};

// Edit product details (Accessible by Admin only)
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, purchase_price, minimum_stock, unit } = req.body;

        if (!name || !category || purchase_price === undefined || minimum_stock === undefined) {
            return res.status(400).json({ error: 'Name, category, purchase_price, and minimum_stock are required for update.' });
        }

        const productUnit = unit && ['pce', 'meter'].includes(unit) ? unit : 'pce';

        // Check if product exists
        const [existing] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        await pool.query(
            `UPDATE products 
             SET name = ?, category = ?, purchase_price = ?, minimum_stock = ?, unit = ? 
             WHERE id = ?`,
            [name, category, purchase_price, minimum_stock, productUnit, id]
        );

        res.json({ message: 'Product updated successfully.' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Internal server error while updating product.' });
    }
};

module.exports = {
    getAllProducts,
    createProduct,
    updateProduct
};