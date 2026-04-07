import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';

export async function getLabPackages(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT * FROM lab_packages WHERE is_active = true ORDER BY is_popular DESC, price ASC'
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getLabTests(req: Request, res: Response, next: NextFunction) {
  try {
    const { category } = req.query;
    let query = 'SELECT * FROM lab_tests WHERE is_active = true';
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

export async function getLabCategories(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await pool.query(
      'SELECT DISTINCT category FROM lab_tests WHERE is_active = true AND category IS NOT NULL ORDER BY category'
    );
    res.json(result.rows.map((r: any) => r.category));
  } catch (error) {
    next(error);
  }
}
