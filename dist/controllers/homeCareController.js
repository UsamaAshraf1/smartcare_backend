import { pool } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { createCaregiverJobSchema } from '../middleware/validators.js';
// ─── Home Visits ─────────────────────────────────────────
export async function getHomeVisits(req, res, next) {
    try {
        const result = await pool.query(`SELECT o.*, hvt.clinician_name, hvt.status as tracking_status,
              hvt.latitude, hvt.longitude, hvt.estimated_arrival
       FROM orders o
       LEFT JOIN home_visit_tracking hvt ON o.id = hvt.order_id
       WHERE o.patient_id = $1 AND o.service_type = 'home_visit'
       ORDER BY o.created_at DESC`, [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getHomeVisitTracking(req, res, next) {
    try {
        const result = await pool.query(`SELECT hvt.*, o.details, o.status as order_status
       FROM home_visit_tracking hvt
       JOIN orders o ON hvt.order_id = o.id
       WHERE hvt.order_id = $1 AND o.patient_id = $2`, [req.params.orderId, req.user.userId]);
        if (result.rows.length === 0) {
            throw new AppError('Tracking data not found', 404);
        }
        res.json(result.rows[0]);
    }
    catch (error) {
        next(error);
    }
}
// ─── Caregiver Jobs ──────────────────────────────────────
export async function getCaregiverPlans(_req, res) {
    res.json([
        { id: 'hourly', name: 'Hourly Support', price: 85, displayPrice: 'AED 85 / hr', description: 'Flexible care for quick tasks or recovery help.' },
        { id: 'shift', name: 'Daily Shift', price: 450, displayPrice: 'AED 450 / shift', description: '8-hour dedicated support for elderly or post-op.' },
        { id: 'monthly', name: 'Monthly Resident', price: 8500, displayPrice: 'AED 8,500 / mo', description: 'Full-time caregiver residing at home.' },
    ]);
}
export async function createCaregiverJob(req, res, next) {
    try {
        const data = createCaregiverJobSchema.parse(req.body);
        const priceMap = { hourly: 85, shift: 450, monthly: 8500 };
        const price = priceMap[data.plan];
        // Create order first
        const order = await pool.query(`INSERT INTO orders (patient_id, service_type, total_amount, details, status, payment_status)
       VALUES ($1, 'caregiver', $2, $3, 'pending_payment', 'unpaid')
       RETURNING *`, [req.user.userId, price, JSON.stringify(data)]);
        // Create caregiver job
        const job = await pool.query(`INSERT INTO caregiver_jobs (order_id, patient_id, plan, start_date, end_date, hours_per_day, tasks, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_payment')
       RETURNING *`, [order.rows[0].id, req.user.userId, data.plan, data.startDate, data.endDate, data.hoursPerDay, JSON.stringify(data.tasks)]);
        res.status(201).json({ order: order.rows[0], job: job.rows[0] });
    }
    catch (error) {
        next(error);
    }
}
export async function getCaregiverJobs(req, res, next) {
    try {
        const result = await pool.query(`SELECT cj.*, o.total_amount, o.payment_status, o.status as order_status
       FROM caregiver_jobs cj
       JOIN orders o ON cj.order_id = o.id
       WHERE cj.patient_id = $1
       ORDER BY cj.created_at DESC`, [req.user.userId]);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=homeCareController.js.map