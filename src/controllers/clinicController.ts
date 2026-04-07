import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';

const HIDDEN_CLINIC_NAMES = new Set([
  'smart care clinic',
  'smart care dubai',
]);

export async function getClinics(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT * FROM clinics WHERE is_active = true ORDER BY name'
    );
    const rows = result.rows.filter((row: any) => !HIDDEN_CLINIC_NAMES.has(String(row.name || '').trim().toLowerCase()));
    res.json(rows);
  } catch (error) {
    next(error);
  }
}

export async function getClinicById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query('SELECT * FROM clinics WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Clinic not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getDoctors(req: Request, res: Response, next: NextFunction) {
  try {
    const { clinicId, specialty } = req.query;
    let query = `
      SELECT d.*, c.name as clinic_name, c.location as clinic_location, c.type as clinic_type
      FROM doctors d
      JOIN clinics c ON d.clinic_id = c.id
      WHERE d.is_available = true
        AND c.is_active = true
        AND LOWER(c.name) NOT IN ('smart care clinic', 'smart care dubai')
    `;
    const params: any[] = [];

    if (clinicId) {
      params.push(clinicId);
      query += ` AND d.clinic_id = $${params.length}`;
    }
    if (specialty) {
      params.push(specialty);
      query += ` AND d.specialty = $${params.length}`;
    }

    query += ' ORDER BY d.rating DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getDoctorById(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      `SELECT d.*, c.name as clinic_name, c.location as clinic_location
       FROM doctors d JOIN clinics c ON d.clinic_id = c.id
       WHERE d.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

export async function getDoctorSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const { date } = req.query;
    let query = `
      SELECT * FROM doctor_slots
      WHERE doctor_id = $1 AND is_booked = false AND is_blocked = false
    `;
    const params: any[] = [req.params.id];

    if (date) {
      params.push(date);
      query += ` AND date = $${params.length}`;
    } else {
      query += ` AND date >= CURRENT_DATE`;
    }

    query += ' ORDER BY date, start_time LIMIT 50';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getSpecialties(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT DISTINCT specialty FROM doctors WHERE is_available = true ORDER BY specialty'
    );
    res.json(result.rows.map((r: any) => r.specialty));
  } catch (error) {
    next(error);
  }
}
