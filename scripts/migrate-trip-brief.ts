import { readFile } from 'fs/promises';
import path from 'path';
import { Pool } from 'pg';

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

async function runMigration(): Promise<void> {
  const filePath = path.resolve(process.cwd(), 'db/migrations/001_trip_briefs.sql');
  const sql = await readFile(filePath, 'utf8');

  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

void runMigration()
  .then(() => {
    console.log('Trip brief migration applied successfully.');
  })
  .catch((error) => {
    console.error('Trip brief migration failed:', error);
    process.exitCode = 1;
  });
