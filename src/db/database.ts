import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import { env } from '../config/env.js';
import type { Database } from './types.js';

const { Pool } = pg;

// Mantiene fechas SQL sin zona horaria como YYYY-MM-DD y evita desplazamientos por huso horario.
pg.types.setTypeParser(1082, (value) => value);

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.databasePoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 15_000,
  query_timeout: 20_000,
  application_name: 'siare-api',
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: true } : undefined,
});

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

export type DatabaseClient = typeof db;

export const closeDatabase = async () => {
  await db.destroy();
};
