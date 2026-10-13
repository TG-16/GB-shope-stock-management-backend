const pool = require('../config/db');

// Helper: restore product stock for an array of sale items within an active transaction connection
const restoreStockForItems = async (connection, items) => {
    for (const item of items) {
        if (item.product_id && Number(item.quantity) > 0) {
            await connection.query(
                'UPDATE products SET current_stock = current_stock + ? WHERE id = ?',
                [Number(item.quantity), item.product_id]
            );
        }
    }
};

// --- 1. Staff requests void for a sale (full or item-level) ---
const requestVoid = async (req, res) => {
    try {
        const staffId = req.user.id;
        const { saleId, voidType = 'FULL_SALE', itemIds = [], reason } = req.body;

        if (!saleId) {
            return res.status(400).json({ error: 'Sale ID is required.' });
        }
        if (!reason || !reason.trim()) {
            return res.status(400).json({ error: 'A reason for voiding is required.' });
        }
        if (voidType === 'ITEM_LEVEL' && (!Array.isArray(itemIds) || itemIds.length === 0)) {
            return res.status(400).json({ error: 'At least one item must be selected for partial void.' });
        }

        // Check that sale exists and is not already VOID
        const [saleRows] = await pool.query('SELECT id, staff_id, status FROM sales WHERE id = ?', [saleId]);
        if (saleRows.length === 0) {
            return res.status(404).json({ error: 'Sale not found.' });
        }
        if (saleRows[0].status === 'VOID') {
            return res.status(400).json({ error: 'This sale has already been voided.' });
        }

        // If staff, verify ownership
        if (req.user.role === 'STAFF' && saleRows[0].staff_id !== staffId) {
            return res.status(403).json({ error: 'You can only request voids for your own sales.' });
        }

        // Prevent duplicate pending requests
        const [existing] = await pool.query(
            'SELECT id FROM void_requests WHERE sale_id = ? AND status = "PENDING"',
            [saleId]
        );
        if (existing.length > 0) {
            return res.status(400).json({ error: 'A pending void request already exists for this sale.' });
        }

        const serializedItemIds = voidType === 'ITEM_LEVEL' ? JSON.stringify(itemIds) : null;

        const [result] = await pool.query(
            `INSERT INTO void_requests (sale_id, requested_by, void_type, item_ids, reason, status) 
             VALUES (?, ?, ?, ?, ?, 'PENDING')`,
            [saleId, staffId, voidType, serializedItemIds, reason.trim()]
        );

        res.status(201).json({
            message: 'Void request submitted successfully for admin review.',
            requestId: result.insertId
        });
    } catch (error) {
        console.error('Error submitting void request:', error);
        res.status(500).json({ error: 'Internal server error submitting void request.' });
    }
};

// --- 2. Admin views pending void requests ---
const getVoidRequests = async (req, res) => {
    try {
        const [requests] = await pool.query(`
            SELECT vr.id AS request_id, vr.sale_id, vr.void_type, vr.item_ids, vr.reason,
                   vr.status, vr.created_at,
                   u.id AS requester_id, u.full_name AS requester_name,
                   s.created_at AS sale_date, s.status AS sale_status
            FROM void_requests vr
            JOIN users u ON vr.requested_by = u.id
            JOIN sales s ON vr.sale_id = s.id
            WHERE vr.status = 'PENDING'
            ORDER BY vr.created_at DESC
        `);

        // Attach sale items to each request for clear administrative context
        for (const reqItem of requests) {
            let parsedIds = [];
            if (reqItem.item_ids) {
                try {
                    parsedIds = typeof reqItem.item_ids === 'string' ? JSON.parse(reqItem.item_ids) : reqItem.item_ids;
                } catch {
                    parsedIds = [];
                }
            }
            reqItem.selectedItemIds = parsedIds;

            const [items] = await pool.query(`
                SELECT si.id AS item_id, si.product_id, p.name AS product_name,
                       si.quantity, si.selling_price, si.historical_purchase_price, p.unit,
                       si.is_voided
                FROM sale_items si
                JOIN products p ON si.product_id = p.id
                WHERE si.sale_id = ?
            `, [reqItem.sale_id]);

            reqItem.items = items;
        }

        res.json(requests);
    } catch (error) {
        console.error('Error fetching void requests:', error);
        res.status(500).json({ error: 'Internal server error fetching void requests.' });
    }
};

// --- 3. Admin approves void request ---
const approveVoidRequest = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { requestId } = req.params;
        const adminId = req.user.id;

        const [reqRows] = await connection.query(
            'SELECT * FROM void_requests WHERE id = ? AND status = "PENDING"',
            [requestId]
        );
        if (reqRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Pending void request not found.' });
        }

        const request = reqRows[0];
        const voidReason = request.reason || 'Approved by Admin';

        if (request.void_type === 'FULL_SALE') {
            // Restore stock for all unvoided items in this sale
            const [itemsToRestore] = await connection.query(
                'SELECT product_id, quantity FROM sale_items WHERE sale_id = ? AND is_voided = FALSE',
                [request.sale_id]
            );
            await restoreStockForItems(connection, itemsToRestore);

            // Void entire sale
            await connection.query('UPDATE sales SET status = "VOID" WHERE id = ?', [request.sale_id]);
            await connection.query(
                `UPDATE sale_items 
                 SET is_voided = TRUE, voided_at = CURRENT_TIMESTAMP, void_reason = ? 
                 WHERE sale_id = ? AND is_voided = FALSE`,
                [voidReason, request.sale_id]
            );
        } else {
            // Item-level void
            let itemIds = [];
            try {
                itemIds = typeof request.item_ids === 'string' ? JSON.parse(request.item_ids) : request.item_ids;
            } catch {
                itemIds = [];
            }

            if (itemIds.length > 0) {
                // Restore stock for specified unvoided items
                const [itemsToRestore] = await connection.query(
                    'SELECT product_id, quantity FROM sale_items WHERE id IN (?) AND sale_id = ? AND is_voided = FALSE',
                    [itemIds, request.sale_id]
                );
                await restoreStockForItems(connection, itemsToRestore);

                await connection.query(
                    `UPDATE sale_items 
                     SET is_voided = TRUE, voided_at = CURRENT_TIMESTAMP, void_reason = ? 
                     WHERE id IN (?) AND sale_id = ? AND is_voided = FALSE`,
                    [voidReason, itemIds, request.sale_id]
                );
            }

            // Check if all items in this sale are now voided
            const [remainingActive] = await connection.query(
                'SELECT COUNT(*) AS activeCount FROM sale_items WHERE sale_id = ? AND is_voided = FALSE',
                [request.sale_id]
            );
            if (remainingActive[0].activeCount === 0) {
                await connection.query('UPDATE sales SET status = "VOID" WHERE id = ?', [request.sale_id]);
            }
        }

        // Mark request as APPROVED
        await connection.query(
            'UPDATE void_requests SET status = "APPROVED", approved_by = ? WHERE id = ?',
            [adminId, requestId]
        );

        await connection.commit();
        res.json({ message: 'Void request approved successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error approving void request:', error);
        res.status(500).json({ error: 'Internal server error approving void request.' });
    } finally {
        connection.release();
    }
};

// --- 4. Admin rejects void request ---
const rejectVoidRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const adminId = req.user.id;

        const [result] = await pool.query(
            'UPDATE void_requests SET status = "REJECTED", approved_by = ? WHERE id = ? AND status = "PENDING"',
            [adminId, requestId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Pending void request not found or already processed.' });
        }

        res.json({ message: 'Void request rejected.' });
    } catch (error) {
        console.error('Error rejecting void request:', error);
        res.status(500).json({ error: 'Internal server error rejecting void request.' });
    }
};

// --- 5. Staff direct void (own sale, same day only) ---
const staffDirectVoid = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { saleId } = req.params;
        const staffId = req.user.id;
        const { reason = 'Same-day correction by staff' } = req.body;

        const [saleRows] = await connection.query(
            'SELECT id, staff_id, status, created_at FROM sales WHERE id = ?',
            [saleId]
        );

        if (saleRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Sale not found.' });
        }

        const sale = saleRows[0];
        if (sale.staff_id !== staffId) {
            await connection.rollback();
            return res.status(403).json({ error: 'You can only void your own sales.' });
        }
        if (sale.status === 'VOID') {
            await connection.rollback();
            return res.status(400).json({ error: 'This sale is already voided.' });
        }

        // Check same-day constraint
        const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];
        if (saleDate !== today) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Staff can only directly void sales from today. For past sales, please submit a void request.'
            });
        }

        // Restore stock for all unvoided items in this sale
        const [itemsToRestore] = await connection.query(
            'SELECT product_id, quantity FROM sale_items WHERE sale_id = ? AND is_voided = FALSE',
            [saleId]
        );
        await restoreStockForItems(connection, itemsToRestore);

        await connection.query('UPDATE sales SET status = "VOID" WHERE id = ?', [saleId]);
        await connection.query(
            `UPDATE sale_items 
             SET is_voided = TRUE, voided_at = CURRENT_TIMESTAMP, void_reason = ? 
             WHERE sale_id = ? AND is_voided = FALSE`,
            [reason, saleId]
        );

        // Clean up any pending requests for this sale
        await connection.query(
            'UPDATE void_requests SET status = "APPROVED", approved_by = ? WHERE sale_id = ? AND status = "PENDING"',
            [staffId, saleId]
        );

        await connection.commit();
        res.json({ message: 'Sale voided successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error during staff direct void:', error);
        res.status(500).json({ error: 'Internal server error voiding sale.' });
    } finally {
        connection.release();
    }
};

// --- 6. Admin direct void (any sale, any date, full or item-level) ---
const adminDirectVoid = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { saleId } = req.params;
        const adminId = req.user.id;
        const { voidType = 'FULL_SALE', itemIds = [], reason = 'Admin direct void' } = req.body;

        const [saleRows] = await connection.query('SELECT id, status FROM sales WHERE id = ?', [saleId]);
        if (saleRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Sale not found.' });
        }
        if (saleRows[0].status === 'VOID') {
            await connection.rollback();
            return res.status(400).json({ error: 'This sale has already been fully voided.' });
        }

        if (voidType === 'FULL_SALE') {
            // Restore stock for all unvoided items
            const [itemsToRestore] = await connection.query(
                'SELECT product_id, quantity FROM sale_items WHERE sale_id = ? AND is_voided = FALSE',
                [saleId]
            );
            await restoreStockForItems(connection, itemsToRestore);

            await connection.query('UPDATE sales SET status = "VOID" WHERE id = ?', [saleId]);
            await connection.query(
                `UPDATE sale_items 
                 SET is_voided = TRUE, voided_at = CURRENT_TIMESTAMP, void_reason = ? 
                 WHERE sale_id = ? AND is_voided = FALSE`,
                [reason, saleId]
            );
        } else {
            if (!Array.isArray(itemIds) || itemIds.length === 0) {
                await connection.rollback();
                return res.status(400).json({ error: 'At least one item must be specified for item-level void.' });
            }

            // Restore stock for specified unvoided items
            const [itemsToRestore] = await connection.query(
                'SELECT product_id, quantity FROM sale_items WHERE id IN (?) AND sale_id = ? AND is_voided = FALSE',
                [itemIds, saleId]
            );
            await restoreStockForItems(connection, itemsToRestore);

            await connection.query(
                `UPDATE sale_items 
                 SET is_voided = TRUE, voided_at = CURRENT_TIMESTAMP, void_reason = ? 
                 WHERE id IN (?) AND sale_id = ? AND is_voided = FALSE`,
                [reason, itemIds, saleId]
            );

            // Check if all items in this sale are voided now
            const [remainingActive] = await connection.query(
                'SELECT COUNT(*) AS activeCount FROM sale_items WHERE sale_id = ? AND is_voided = FALSE',
                [saleId]
            );
            if (remainingActive[0].activeCount === 0) {
                await connection.query('UPDATE sales SET status = "VOID" WHERE id = ?', [saleId]);
            }
        }

        // Clean up any pending void requests for this sale
        await connection.query(
            'UPDATE void_requests SET status = "APPROVED", approved_by = ? WHERE sale_id = ? AND status = "PENDING"',
            [adminId, saleId]
        );

        await connection.commit();
        res.json({ message: 'Void applied successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('Error during admin direct void:', error);
        res.status(500).json({ error: 'Internal server error applying void.' });
    } finally {
        connection.release();
    }
};

module.exports = {
    requestVoid,
    getVoidRequests,
    approveVoidRequest,
    rejectVoidRequest,
    staffDirectVoid,
    adminDirectVoid
};
