const pool = require('../config/db');

const runMigrations = async () => {
    try {
        console.log('🔄 Running database migrations...');

        // 1. Modify sales status ENUM to include VOID
        await pool.query(`
            ALTER TABLE sales MODIFY COLUMN status 
            ENUM('ACTIVE', 'VOID', 'CORRECTED', 'CREDIT', 'CREDIT_PAID') 
            NOT NULL DEFAULT 'ACTIVE'
        `);
        console.log('✅ Updated sales.status ENUM to include VOID.');

        // 2. Add is_voided, voided_at, void_reason to sale_items if not present
        const [columns] = await pool.query("SHOW COLUMNS FROM sale_items LIKE 'is_voided'");
        if (columns.length === 0) {
            await pool.query(`
                ALTER TABLE sale_items 
                ADD COLUMN is_voided BOOLEAN NOT NULL DEFAULT FALSE,
                ADD COLUMN voided_at TIMESTAMP NULL,
                ADD COLUMN void_reason TEXT NULL
            `);
            console.log('✅ Added is_voided, voided_at, void_reason columns to sale_items.');
        } else {
            console.log('ℹ️ sale_items columns already exist.');
        }

        // 3. Create void_requests table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS void_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                sale_id INT NOT NULL,
                requested_by INT NOT NULL,
                approved_by INT NULL,
                void_type ENUM('FULL_SALE', 'ITEM_LEVEL') NOT NULL,
                item_ids JSON NULL,
                reason TEXT NOT NULL,
                status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (sale_id) REFERENCES sales(id),
                FOREIGN KEY (requested_by) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            )
        `);
        console.log('✅ Ensured void_requests table exists.');

        // 4. Create notes table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);
        console.log('✅ Ensured notes table exists.');

        console.log('🎉 Migrations completed successfully.');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
};

if (require.main === module) {
    runMigrations()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = runMigrations;
