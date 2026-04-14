import { pool } from '../config/database.js';
export async function getLabPackages(req, res, next) {
    try {
        const result = await pool.query('SELECT * FROM lab_packages WHERE is_active = true ORDER BY is_popular DESC, price ASC');
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getLabTests(req, res, next) {
    try {
        const { category } = req.query;
        let query = 'SELECT * FROM lab_tests WHERE is_active = true';
        const params = [];
        if (category) {
            params.push(category);
            query += ` AND category = $${params.length}`;
        }
        query += ' ORDER BY name';
        const result = await pool.query(query, params);
        res.json(result.rows);
    }
    catch (error) {
        next(error);
    }
}
export async function getLabCategories(req, res, next) {
    try {
        const result = await pool.query('SELECT DISTINCT category FROM lab_tests WHERE is_active = true AND category IS NOT NULL ORDER BY category');
        res.json(result.rows.map((r) => r.category));
    }
    catch (error) {
        next(error);
    }
}
//# sourceMappingURL=labController.js.map