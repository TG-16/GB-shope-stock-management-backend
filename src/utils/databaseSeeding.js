const bcrypt = require('bcrypt');
const pool = require('../config/db');

const seedInitialSuperAdmin = async () => {
    try {
        // Check if any user exists
        const [users] = await pool.query('SELECT COUNT(*) AS count FROM users');
        
        if (users[0].count === 0) {
            const defaultUsername = 'superadmin';
            const defaultPassword = 'ChangeMe123!';
            const hashedPassword = await bcrypt.hash(defaultPassword, 10);

            await pool.query(
                `INSERT INTO users (full_name, username, password_hash, role, status) 
                 VALUES (?, ?, ?, 'SUPER_ADMIN', 'ACTIVE')`,
                ['System Super Admin', defaultUsername, hashedPassword]
            );

            console.log('----------------------------------------------------');
            console.log('Initial SUPER_ADMIN account created successfully!');
            console.log(`Username: ${defaultUsername}`);
            console.log(`Password: ${defaultPassword}`);
            console.log('Please log in and change this password immediately.');
            console.log('----------------------------------------------------');
        }
    } catch (error) {
        console.error('Error seeding initial Super Admin:', error);
    }
};

module.exports = seedInitialSuperAdmin;