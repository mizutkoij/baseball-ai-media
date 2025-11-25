// app/lib/db.ts
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.PGURL,
  max: 5,
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined,
});

export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const { rows } = await pool.query(text, params);
  return rows as T[];
}

export { pool };