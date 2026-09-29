const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const pool = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'Stock Management System API V1 is running.' 
    });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);

// TODO: Mount your API routes here once created
// ##### app.use('/api/auth', authRoutes); 
// ##### app.use('/api/products', productRoutes);
// app.use('/api/sales', saleRoutes);
// app.use('/api/purchases', purchaseRoutes);
// app.use('/api/adjustments', adjustmentRoutes);
// app.use('/api/daily-reports', dailyReportRoutes);
// app.use('/api/banks', bankRoutes);
// app.use('/api/staff', staffRoutes);

// Global Error Handler Middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err.stack);
    res.status(500).json({ error: 'Internal server error.' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});