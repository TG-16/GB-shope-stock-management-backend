const jwt = require('jsonwebtoken');

// 1. Verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }
        req.user = user; // Attach payload { id, username, role, status } to request
        next();
    });
};

// 2. Role-Based Access Control (RBAC)
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Access denied: You do not have permission to perform this action.' 
            });
        }
        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles
};