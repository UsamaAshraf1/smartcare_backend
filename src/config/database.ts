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
import https from 'https';

dotenv.config();

// === BEST SOLUTION: Download CA bundle at runtime (No local file needed) ===
const getRdsCaBundle = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    const url = 'https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem';

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download CA bundle: ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// Initialize pool with lazy CA loading
let pool: Pool;

const initializePool = async () => {
  try {
    const ca = await getRdsCaBundle();

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true,        // Keep this true in production
        ca: ca,
      },
      // Optional: Good settings for serverless
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    console.log('✅ PostgreSQL Pool initialized with RDS CA bundle');
  } catch (error) {
    console.error('❌ Failed to download RDS CA bundle:', error);
    
    // Fallback: Use rejectUnauthorized: false (less secure but works)
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });
    console.warn('⚠️  Using fallback SSL (rejectUnauthorized: false)');
  }
};

// Initialize immediately when this module is imported
initializePool().catch(console.error);

export { pool };

export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connected successfully to RDS');
    client.release();
    return true;
  } catch (error: any) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};