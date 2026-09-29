const pool = require('../config/db');

const getBanks = async (req, res) => {
    try {
        const [banks] = await pool.query('SELECT id, name, created_at FROM banks ORDER BY name ASC');
        res.json(banks);
    } catch (error) {
        console.error('Error fetching banks:', error);
        res.status(500).json({ error: 'Internal server error fetching banks.' });
    }
};

const createBank = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ error: 'Bank name is required.' });

        const [result] = await pool.query('INSERT INTO banks (name) VALUES (?)', [name]);
        res.status(201).json({ message: 'Bank added successfully', bankId: result.insertId });
    } catch (error) {
        console.error('Error creating bank:', error);
        res.status(500).json({ error: 'Internal server error or bank already exists.' });
    }
};

module.exports = { getBanks, createBank };