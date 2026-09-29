const pool = require('../config/db');
const bcrypt = require('bcryptjs');

// Register a new staff account (Admin)
const registerStaff = async (req, res) => {
    try {
        const { fullName, username, password } = req.body;
        if (!fullName || !username || !password) {
            return res.status(400).json({ error: 'Full name, username, and password are required.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO users (full_name, username, password_hash, role, status) 
             VALUES (?, ?, ?, 'STAFF', 'ACTIVE')`,
            [fullName, username, hashedPassword]
        );

        res.status(201).json({ message: 'Staff registered successfully.', staffId: result.insertId });
    } catch (error) {
        console.error('Error registering staff:', error);
        res.status(500).json({ error: 'Internal server error or username already taken.' });
    }
};

// Revoke or unrevoke staff status (Admin)
const updateStaffStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'ACTIVE' or 'REVOKED'

        if (!['ACTIVE', 'REVOKED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status. Must be ACTIVE or REVOKED.' });
        }

        await pool.query('UPDATE users SET status = ? WHERE id = ? AND role = "STAFF"', [status, id]);
        res.json({ message: `Staff status updated to ${status} successfully.` });
    } catch (error) {
        console.error('Error updating staff status:', error);
        res.status(500).json({ error: 'Internal server error updating staff status.' });
    }
};

// List all staff
const getAllStaff = async (req, res) => {
    try {
        const [staff] = await pool.query('SELECT id, full_name, username, status, created_at FROM users WHERE role = "STAFF" ORDER BY full_name ASC');
        res.json(staff);
    } catch (error) {
        console.error('Error fetching staff:', error);
        res.status(500).json({ error: 'Internal server error fetching staff.' });
    }
};

module.exports = { registerStaff, updateStaffStatus, getAllStaff };