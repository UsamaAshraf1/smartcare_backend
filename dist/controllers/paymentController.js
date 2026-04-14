import Stripe from 'stripe';
import { pool } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});
// ─── Helpers ────────────────────────────────────────────
async function getOrCreateStripeCustomer(userId) {
    const user = await pool.query('SELECT stripe_customer_id, email, name, phone FROM users WHERE id = $1', [userId]);
    if (user.rows.length === 0)
        throw new AppError('User not found', 404);
    const row = user.rows[0];
    if (row.stripe_customer_id)
        return row.stripe_customer_id;
    const customer = await stripe.customers.create({
        email: row.email || undefined,
        name: row.name || undefined,
        phone: row.phone || undefined,
        metadata: { smartcare_user_id: userId },
    });
    await pool.query('UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2', [customer.id, userId]);
    return customer.id;
}
// ─── Setup Intent (for adding a new card) ───────────────
export async function createSetupIntent(req, res, next) {
    try {
        const customerId = await getOrCreateStripeCustomer(req.user.userId);
        const setupIntent = await stripe.setupIntents.create({
            customer: customerId,
            payment_method_types: ['card'],
        });
        res.json({
            clientSecret: setupIntent.client_secret,
            customerId,
        });
    }
    catch (error) {
        next(error);
    }
}
// ─── List saved payment methods ─────────────────────────
export async function listPaymentMethods(req, res, next) {
    try {
        const result = await pool.query(`SELECT id, brand, last4, exp_month, exp_year, is_default, created_at
       FROM saved_payment_methods
       WHERE user_id = $1
       ORDER BY is_default DESC, created_at DESC`, [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
// ─── Save a payment method after SetupIntent confirms ───
export async function savePaymentMethod(req, res, next) {
    try {
        const { paymentMethodId } = req.body;
        if (!paymentMethodId || typeof paymentMethodId !== 'string') {
            throw new AppError('paymentMethodId is required', 400);
        }
        const customerId = await getOrCreateStripeCustomer(req.user.userId);
        // Attach to customer (idempotent if already attached)
        try {
            await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        }
        catch (attachErr) {
            if (attachErr.code !== 'resource_already_exists')
                throw attachErr;
        }
        // Retrieve card details from Stripe
        const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
        if (!pm.card) {
            throw new AppError('Only card payment methods are supported', 400);
        }
        // Check for duplicate
        const existing = await pool.query('SELECT id FROM saved_payment_methods WHERE user_id = $1 AND stripe_pm_id = $2', [req.user.userId, paymentMethodId]);
        if (existing.rows.length > 0) {
            res.json({ message: 'Card already saved', id: existing.rows[0].id });
            return;
        }
        // If user has no cards yet, make this the default
        const cardCount = await pool.query('SELECT COUNT(*) as count FROM saved_payment_methods WHERE user_id = $1', [req.user.userId]);
        const isDefault = parseInt(cardCount.rows[0].count) === 0;
        const result = await pool.query(`INSERT INTO saved_payment_methods (user_id, stripe_pm_id, brand, last4, exp_month, exp_year, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, brand, last4, exp_month, exp_year, is_default, created_at`, [
            req.user.userId,
            paymentMethodId,
            pm.card.brand,
            pm.card.last4,
            pm.card.exp_month,
            pm.card.exp_year,
            isDefault,
        ]);
        res.status(201).json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
}
// ─── Delete a saved payment method ──────────────────────
export async function deletePaymentMethod(req, res, next) {
    try {
        const { id } = req.params;
        const card = await pool.query('SELECT stripe_pm_id, is_default FROM saved_payment_methods WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
        if (card.rows.length === 0) {
            throw new AppError('Payment method not found', 404);
        }
        // Detach from Stripe
        try {
            await stripe.paymentMethods.detach(card.rows[0].stripe_pm_id);
        }
        catch (detachErr) {
            // Ignore if already detached
            if (detachErr.code !== 'resource_missing') {
                console.error('[Payment] Stripe detach error:', detachErr.message);
            }
        }
        await pool.query('DELETE FROM saved_payment_methods WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
        // If it was the default, promote the next card
        if (card.rows[0].is_default) {
            await pool.query(`UPDATE saved_payment_methods SET is_default = true
         WHERE id = (
           SELECT id FROM saved_payment_methods WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1
         )`, [req.user.userId]);
        }
        res.json({ message: 'Payment method deleted' });
    }
    catch (error) {
        next(error);
    }
}
// ─── Set default payment method ─────────────────────────
export async function setDefaultMethod(req, res, next) {
    try {
        const { id } = req.params;
        const card = await pool.query('SELECT id FROM saved_payment_methods WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
        if (card.rows.length === 0) {
            throw new AppError('Payment method not found', 404);
        }
        await pool.query('BEGIN');
        try {
            await pool.query('UPDATE saved_payment_methods SET is_default = false WHERE user_id = $1', [req.user.userId]);
            await pool.query('UPDATE saved_payment_methods SET is_default = true WHERE id = $1 AND user_id = $2', [id, req.user.userId]);
            await pool.query('COMMIT');
        }
        catch (txErr) {
            await pool.query('ROLLBACK');
            throw txErr;
        }
        res.json({ message: 'Default payment method updated' });
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=paymentController.js.map