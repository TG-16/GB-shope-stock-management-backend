-- Create Database
CREATE DATABASE IF NOT EXISTS stock_management_v1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stock_management_v1;

-- 1. Banks Table (Configurable payment destinations like CBE, Awash, etc.)
CREATE TABLE banks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Super Admin, Admin, Staff)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE, -- this can be phone number
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('SUPER_ADMIN', 'ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
    status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Products Table (Stores current stock, minimum stock, and current purchase price)
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL,
    current_stock INT NOT NULL DEFAULT 0,
    minimum_stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. Sales Table (Header for individual transactions handled by staff)
CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    status ENUM('ACTIVE', 'CORRECTED') NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- 5. Sale Items Table (Line items supporting multiple products per sale, capturing historical purchase price for profit)
CREATE TABLE sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    selling_price DECIMAL(10, 2) NOT NULL,
    historical_purchase_price DECIMAL(10, 2) NOT NULL, -- Preserves cost at time of sale for profit calculation
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 6. Purchases Table (Purchase requests created by staff and reviewed/approved by admin)[cite: 1]
CREATE TABLE purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    staff_id INT NOT NULL, -- Staff who requested
    quantity INT NOT NULL,
    purchase_price DECIMAL(10, 2) NOT NULL, -- Price at purchase time
    status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (staff_id) REFERENCES users(id)
);

-- 7. Stock Adjustments Table (Manual adjustments made by admin with mandatory reason)[cite: 1]
CREATE TABLE stock_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    admin_id INT NOT NULL, -- Admin who performed the adjustment
    quantity_change INT NOT NULL, -- Can be positive (+2) or negative (-3)
    reason TEXT NOT NULL, -- Mandatory reason description
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

-- 8. Daily Reports Table (Staff end-of-day money deposit reports)[cite: 1]
CREATE TABLE daily_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_id INT NOT NULL,
    bank_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    report_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES users(id),
    FOREIGN KEY (bank_id) REFERENCES banks(id)
);