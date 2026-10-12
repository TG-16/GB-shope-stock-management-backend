const pool = require('../config/db');

// --- 1. Create a Note ---
const createNote = async (req, res) => {
    try {
        const userId = req.user.id;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Note content cannot be empty.' });
        }

        const [result] = await pool.query(
            'INSERT INTO notes (user_id, content) VALUES (?, ?)',
            [userId, content.trim()]
        );

        res.status(201).json({
            message: 'Note saved successfully.',
            noteId: result.insertId
        });
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Internal server error saving note.' });
    }
};

// --- 2. Get Notes with Role-Based Visibility ---
// STAFF: sees own notes only
// ADMIN: sees staff notes and all admin notes (excludes super admin notes)
// SUPER_ADMIN: sees everyone's notes
const getNotes = async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        const { date, from, to } = req.query;

        let query = `
            SELECT n.id, n.content, n.created_at, 
                   u.id AS user_id, u.full_name AS author_name, u.role AS author_role
            FROM notes n
            JOIN users u ON n.user_id = u.id
            WHERE 1=1
        `;
        const queryParams = [];

        // Role-based visibility scoping
        if (role === 'STAFF') {
            query += ' AND n.user_id = ?';
            queryParams.push(userId);
        } else if (role === 'ADMIN') {
            query += " AND u.role IN ('STAFF', 'ADMIN')";
        } else if (role === 'SUPER_ADMIN') {
            // Super Admin sees all notes - no filter needed
        }

        // Optional date filters
        if (date) {
            query += ' AND DATE(n.created_at) = ?';
            queryParams.push(date);
        } else if (from && to) {
            query += ' AND DATE(n.created_at) BETWEEN ? AND ?';
            queryParams.push(from, to);
        }

        query += ' ORDER BY n.created_at DESC';

        const [notes] = await pool.query(query, queryParams);
        res.json(notes);
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Internal server error fetching notes.' });
    }
};

module.exports = {
    createNote,
    getNotes
};
