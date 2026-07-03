import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { env } from '../src/config/env.js';

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 1,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : undefined,
});

const run = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const directory = path.resolve('migrations');
    const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.sql')).sort();

    for (const file of files) {
      const exists = await client.query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
      if (exists.rowCount) continue;

      await client.query('BEGIN');
      try {
        await client.query(await fs.readFile(path.join(directory, file), 'utf8'));
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.info(`Migración aplicada: ${file}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
};

await run();
