// import pg from 'pg';
// import { drizzle } from 'drizzle-orm/node-postgres';
// import dotenv from 'dotenv';
// dotenv.config();
// const pool = new pg.Pool({
//   connectionString: process.env.DATABASE_URL,
//   max: 20,
//   idleTimeoutMillis: 30000,
//   connectionTimeoutMillis: 5000,
// });
// pool.on('error', (err) => {
//   console.error('Unexpected database pool error:', err);
//   process.exit(-1);
// });
// export const db = drizzle(pool);
// export { pool };
// export async function testConnection(): Promise<boolean> {
//   try {
//     const client = await pool.connect();
//     await client.query('SELECT NOW()');
//     client.release();
//     return true;
//   } catch (error) {
//     console.error('❌ Database connection failed:', error);
//     return false;
//   }
// }
// config/database.ts
// config/database.ts
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();
// === CHANGE THIS PART ===
const caPath = path.resolve('C:\\Users\\DELL\\rds-ca-bundle.pem'); // ← Full absolute path
// If you're on Windows, use double backslashes or forward slashes like this:
// const caPath = 'C:/Users/Usama/Downloads/rds-ca-bundle.pem';
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
        ca: fs.readFileSync(caPath).toString(),
    },
});
export const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL connected successfully (RDS with CA)');
        client.release();
        return true;
    }
    catch (error) {
        console.error('❌ Database connection failed:', error.message);
        if (error.code === 'ENOENT') {
            console.error('   → PEM file not found at path:', caPath);
        }
        return false;
    }
};
//# sourceMappingURL=database.js.map