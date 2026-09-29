const mysql = require('mysql2/promise');
require('dotenv').config();

// Create the connection pool using environment variables
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stock_management_v1',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test the connection on startup
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connected to the MySQL database successfully.');
        connection.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
    }
})();

module.exports = pool;