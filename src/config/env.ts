import 'dotenv/config';

const required = (name: string, minimumLength = 1): string => {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new Error(`La variable ${name} es obligatoria y debe tener al menos ${minimumLength} caracteres`);
  }
  return value;
};

const integer = (name: string, fallback: number, minimum = 1): number => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`La variable ${name} debe ser un entero mayor o igual a ${minimum}`);
  }
  return value;
};

const boolean = (name: string, fallback: boolean): boolean => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`La variable ${name} debe ser true o false`);
};

export const env = Object.freeze({
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  host: process.env['HOST'] ?? '0.0.0.0',
  port: integer('PORT', 3000),
  logLevel: process.env['LOG_LEVEL'] ?? 'info',
  databaseUrl: required('DATABASE_URL'),
  databasePoolMax: integer('DATABASE_POOL_MAX', 10),
  jwtAccessSecret: required('JWT_ACCESS_SECRET', 32),
  accessTokenTtl: process.env['ACCESS_TOKEN_TTL'] ?? '15m',
  refreshTokenDays: integer('REFRESH_TOKEN_DAYS', 7),
  cookieSecure: boolean('COOKIE_SECURE', process.env['NODE_ENV'] === 'production'),
  corsOrigins: (process.env['CORS_ORIGINS'] ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
});

export type AppEnv = typeof env;
