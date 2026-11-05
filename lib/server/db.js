import pg from 'pg';

const { Pool } = pg;
const globalForPg = globalThis;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL is required for the API.');
    error.code = 'service_unavailable';
    throw error;
  }

  if (!globalForPg.golfPool) {
    globalForPg.golfPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_MAX || 10),
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    });
  }

  return globalForPg.golfPool;
}

export async function inTransaction(operation) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const value = await operation(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
