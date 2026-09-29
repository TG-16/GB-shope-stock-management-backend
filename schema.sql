-- Create Database
CREATE DATABASE IF NOT EXISTS stock_management_v1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stock_management_v1;

-- 1. Banks Table
CREATE TABLE banks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Products Table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL,
    current_stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    minimum_stock DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    unit ENUM('pce', 'meter') NOT NULL DEFAULT 'pce',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Sales Table (Supports ACTIVE, CORRECTED, CREDIT, and CREDIT_PAID statuses)
CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    status ENUM('ACTIVE', 'CORRECTED', 'CREDIT', 'CREDIT_PAID') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- 5. Sale Items Table
CREATE TABLE sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    historical_purchase_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 6. Purchases Table
CREATE TABLE purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    staff_id INT NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL,
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- 7. Stock Adjustments Table
CREATE TABLE stock_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    admin_id INT NOT NULL,
    quantity_change DECIMAL(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- 8. Daily Reports Header Table
CREATE TABLE daily_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    daily_sells_amount DECIMAL(12, 2) NOT NULL,
    report_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- 9. Daily Report Entries (Split Bank Deposits)
CREATE TABLE daily_report_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    daily_report_id INT NOT NULL,
    bank_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (daily_report_id) REFERENCES daily_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (bank_id) REFERENCES banks(id)
);

-- 10. Daily Expenses Table (Staff registered expenses)
CREATE TABLE daily_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    reason TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id)
);


-- 11. Credit Payment Requests Table (Staff requests approval when credit is paid, Admin approves)
CREATE TABLE credit_payment_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL, -- The original CREDIT sale being paid off
    staff_id INT NOT NULL, -- Staff who submitted the request
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);