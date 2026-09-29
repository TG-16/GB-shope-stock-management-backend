const express = require('express');
const cors = require('cors');
require('dotenv').config();

const pool = require('./config/db');

// Import all route modules
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const saleRoutes = require('./routes/saleRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const reportRoutes = require('./routes/reportsRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const adjustmentRoutes = require('./routes/adjustmentRoutes');
const dailyReportRoutes = require('./routes/dailyReportRoutes');
const bankRoutes = require('./routes/bankRoutes');
const staffRoutes = require('./routes/staffRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
    res.json({ 
        status: 'online', 
        message: 'Stock Management System API V1 is 100% complete and fully operational.' 
    });
});

// Mount All API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/adjustments', adjustmentRoutes);
app.use('/api/daily-reports', dailyReportRoutes);
app.use('/api/banks', bankRoutes);
app.use('/api/staff', staffRoutes);

// TODO: Mount your API routes here once created
// ##### app.use('/api/auth', authRoutes); 
// ##### app.use('/api/products', productRoutes);
// ##### app.use('/api/sales', saleRoutes);
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