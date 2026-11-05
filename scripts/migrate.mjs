import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { fileURLToPath } from 'node:url';

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL before running database migrations.');
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
});
const root = path.dirname(fileURLToPath(import.meta.url));

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(path.join(root, '..', 'db', 'migrations')))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of files) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(631984027)');
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (applied.rowCount) {
        await client.query('COMMIT');
        console.log(`Already applied: ${name}`);
        continue;
      }

      const sql = await readFile(path.join(root, '..', 'db', 'migrations', name), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      await client.query('COMMIT');
      console.log(`Applied: ${name}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
