const pool = require('../config/db');
const bcrypt = require('bcrypt');

// --- 1. USER MANAGEMENT ---

// Register any user (ADMIN, STAFF, or another SUPER_ADMIN)
const registerUser = async (req, res) => {
    try {
        const { fullName, username, password, role } = req.body;

        if (!fullName || !username || !password || !role) {
            return res.status(400).json({ error: 'All fields (fullName, username, password, role) are required.' });
        }

        if (!['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified.' });
        }

        // Check if username already exists
        const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'username is already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            'INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)',
            [fullName, username, hashedPassword, role]
        );

        res.status(201).json({ 
            message: `${role} registered successfully.`, 
            userId: result.insertId 
        });
    } catch (error) {
        console.error('Error registering user by super admin:', error);
        res.status(500).json({ error: 'Internal server error registering user.' });
    }
};

// Get all users in the system
const getAllUsers = async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, full_name, username, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error fetching users.' });
    }
};

// Update user details (Name, username, Role)
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, username, role } = req.body;

        if (!fullName || !username || !role) {
            return res.status(400).json({ error: 'fullName, username, and role are required.' });
        }

        if (!['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role specified.' });
        }

        const [userCheck] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
        if (userCheck.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        await pool.query(
            'UPDATE users SET full_name = ?, username = ?, role = ? WHERE id = ?',
            [fullName, username, role, id]
        );

        res.json({ message: 'User updated successfully.' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error updating user.' });
    }
};

// Force change password for any user (Revoke / Reset Access)
const changeUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'New password is required and must be at least 6 characters.' });
        }

        const [userCheck] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
        if (userCheck.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedPassword, id]);

        res.json({ message: 'User password updated successfully.' });
    } catch (error) {
        console.error('Error changing user password:', error);
        res.status(500).json({ error: 'Internal server error changing user password.' });
    }
};

// Delete or revoke a user account
const deleteUser = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { id } = req.params;

        // Prevent self-deletion
        if (Number(id) === req.user.id) {
            return res.status(400).json({ error: 'You cannot delete your own super admin account.' });
        }

        const [userCheck] = await connection.query('SELECT id FROM users WHERE id = ?', [id]);
        if (userCheck.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Delete user (foreign keys like sales/purchases might need nullifying or cascade depending on your schema setup)
        await connection.query('DELETE FROM users WHERE id = ?', [id]);

        await connection.commit();
        res.json({ message: 'User deleted/revoked successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error deleting user. Ensure user has no dependent records or check foreign keys.' });
    } finally {
        connection.release();
    }
};

// --- 2. GLOBAL SYSTEM OVERRIDES (Master Access to Records) ---

// Force delete or cancel any sale record across the system
const forceDeleteSale = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { saleId } = req.params;

        const [sale] = await connection.query('SELECT id, status FROM sales WHERE id = ?', [saleId]);
        if (sale.length === 0) {
            return res.status(404).json({ error: 'Sale record not found.' });
        }

        // If active, restore product stocks before deleting or marking void
        const [items] = await connection.query('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?', [saleId]);
        
        for (const item of items) {
            await connection.query(
                'UPDATE products SET current_stock = current_stock + ? WHERE id = ?',
                [item.quantity, item.product_id]
            );
        }

        await connection.query('DELETE FROM sale_items WHERE sale_id = ?', [saleId]);
        await connection.query('DELETE FROM sales WHERE id = ?', [saleId]);

        await connection.commit();
        res.json({ message: 'Sale record force-deleted and stock restored successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error force deleting sale:', error);
        res.status(500).json({ error: 'Internal server error force deleting sale.' });
    } finally {
        connection.release();
    }
};

module.exports = {
    registerUser,
    getAllUsers,
    updateUser,
    changeUserPassword,
    deleteUser,
    forceDeleteSale
};