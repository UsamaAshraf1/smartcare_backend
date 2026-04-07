import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { updateProfileSchema, updatePreferencesSchema } from '../middleware/validators.js';

// ─── Profile ─────────────────────────────────────────────

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateProfileSchema.parse(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = $${idx}`);
        values.push(key === 'emergencyContact' ? JSON.stringify(value) : value);
        idx++;
      }
    }

    if (fields.length === 0) {
      throw new AppError('No fields to update', 400);
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.user!.userId);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, name, email, phone, emirates_id, passport_number, emr_id, date_of_birth, gender, blood_type, emergency_contact`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function updatePreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updatePreferencesSchema.parse(req.body);

    const result = await pool.query(
      `UPDATE users SET preferences = preferences || $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING preferences`,
      [req.user!.userId, JSON.stringify(data)]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

// ─── Notifications ───────────────────────────────────────

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const { unreadOnly } = req.query;
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    const params: any[] = [req.user!.userId];

    if (unreadOnly === 'true') {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY sent_at DESC LIMIT 50';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function markNotificationRead(req: Request, res: Response, next: NextFunction) {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.userId]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
}

export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [req.user!.userId]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [req.user!.userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    next(error);
  }
}

// ─── Promotions ──────────────────────────────────────────

export async function getPromotions(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name as clinic_name
       FROM promotions p
       LEFT JOIN clinics c ON p.clinic_id = c.id
       WHERE p.is_active = true AND (p.valid_until IS NULL OR p.valid_until > NOW())
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}
