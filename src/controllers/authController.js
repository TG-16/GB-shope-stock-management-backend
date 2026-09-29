const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // Find user by username
        const [rows] = await pool.query(
            'SELECT id, full_name, username, password_hash, role, status FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const user = rows[0];

        // Check if staff/admin account is revoked
        if (user.status === 'REVOKED') {
            return res.status(403).json({ error: 'This account has been revoked. Access denied.' });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        // Generate JWT Token (valid for 12 hours, for example)
        const tokenPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            status: user.status
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '12h' });

        // Send response back
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                username: user.username,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error during login.' });
    }
};

module.exports = {
    login
};