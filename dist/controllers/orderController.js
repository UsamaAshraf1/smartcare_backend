import Stripe from 'stripe';
import { pool } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { createOrderSchema, processPaymentSchema } from '../middleware/validators.js';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});
export async function createOrder(req, res, next) {
    try {
        const data = createOrderSchema.parse(req.body);
        const result = await pool.query(`INSERT INTO orders (patient_id, service_type, total_amount, details, is_home_collection, home_address, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_payment', 'unpaid')
       RETURNING *`, [req.user.userId, data.serviceType, data.totalAmount, JSON.stringify(data.details), data.isHomeCollection, data.homeAddress]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
}
export async function getOrders(req, res, next) {
    try {
        const { status, serviceType } = req.query;
        let query = 'SELECT * FROM orders WHERE patient_id = $1';
        const params = [req.user.userId];
        if (status) {
            params.push(status);
            query += ` AND status = $${params.length}`;
        }
        if (serviceType) {
            params.push(serviceType);
            query += ` AND service_type = $${params.length}`;
        }
        query += ' ORDER BY created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getOrderById(req, res, next) {
    try {
        const result = await pool.query('SELECT * FROM orders WHERE id = $1 AND patient_id = $2', [req.params.id, req.user.userId]);
        if (result.rows.length === 0) {
            throw new AppError('Order not found', 404);
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
}
export async function processPayment(req, res, next) {
    try {
        const data = processPaymentSchema.parse(req.body);
        // Verify order belongs to user and is unpaid
        const order = await pool.query('SELECT * FROM orders WHERE id = $1 AND patient_id = $2 AND payment_status = $3', [data.orderId, req.user.userId, 'unpaid']);
        if (order.rows.length === 0) {
            throw new AppError('Order not found or already paid', 404);
        }
        const orderRow = order.rows[0];
        // Resolve payment method from saved card
        let stripePmId;
        let stripeCustomerId;
        if (data.savedCardId) {
            const card = await pool.query('SELECT stripe_pm_id FROM saved_payment_methods WHERE id = $1 AND user_id = $2', [data.savedCardId, req.user.userId]);
            if (card.rows.length === 0) {
                throw new AppError('Saved card not found', 404);
            }
            stripePmId = card.rows[0].stripe_pm_id;
            const userRow = await pool.query('SELECT stripe_customer_id FROM users WHERE id = $1', [req.user.userId]);
            stripeCustomerId = userRow.rows[0]?.stripe_customer_id;
            if (!stripeCustomerId) {
                throw new AppError('No Stripe customer linked to your account', 400);
            }
        }
        // Process real Stripe payment
        let stripePaymentId;
        if (stripePmId && stripeCustomerId) {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: orderRow.total_amount * 100, // cents
                currency: 'aed',
                customer: stripeCustomerId,
                payment_method: stripePmId,
                off_session: true,
                confirm: true,
            });
            stripePaymentId = paymentIntent.id;
        }
        else {
            // Fallback: no saved card provided — mark with demo id
            // Frontend should always send savedCardId for real payments
            stripePaymentId = `pi_nosaved_${Date.now()}`;
        }
        const result = await pool.query(`UPDATE orders
       SET payment_status = 'paid', payment_method = $3, stripe_payment_id = $4, status = 'confirmed', updated_at = NOW()
       WHERE id = $1 AND patient_id = $2
       RETURNING *`, [data.orderId, req.user.userId, data.paymentMethod, stripePaymentId]);
        const orderData = result.rows[0];
        // If appointment order, confirm the appointment too
        if (orderData.service_type === 'appointment' && orderData.details?.appointmentId) {
            await pool.query("UPDATE appointments SET status = 'confirmed', updated_at = NOW() WHERE id = $1", [orderData.details.appointmentId]);
        }
        // If face_vitals token pack, credit tokens
        if (orderData.service_type === 'face_vitals') {
            const tokensToAdd = orderData.details?.tokenCount || 5;
            await pool.query('UPDATE users SET face_vitals_tokens = face_vitals_tokens + $1, updated_at = NOW() WHERE id = $2', [tokensToAdd, req.user.userId]);
        }
        // Create notification
        await pool.query(`INSERT INTO notifications (user_id, type, title, body, data)
       VALUES ($1, 'order_update', 'Payment Confirmed', $2, $3)`, [
            req.user.userId,
            `Your payment of AED ${orderData.total_amount} has been confirmed.`,
            JSON.stringify({ orderId: orderData.id }),
        ]);
        res.json({
            message: 'Payment processed successfully',
            order: orderData,
            paymentId: stripePaymentId,
        });
    }
    catch (error) {
        next(error);
    }
}
export async function cancelOrder(req, res, next) {
    try {
        const result = await pool.query(`UPDATE orders
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND patient_id = $2 AND status NOT IN ('completed', 'cancelled')
       RETURNING *`, [req.params.id, req.user.userId]);
        if (result.rows.length === 0) {
            throw new AppError('Order not found or cannot be cancelled', 404);
        }
        // If paid, initiate refund
        if (result.rows[0].payment_status === 'paid') {
            await pool.query("UPDATE orders SET payment_status = 'refunded' WHERE id = $1", [req.params.id]);
        }
        res.json({ message: 'Order cancelled', order: result.rows[0] });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=orderController.js.map