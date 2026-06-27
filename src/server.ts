import { buildApp } from './app.js';
import { closeDatabase } from './db/database.js';
import { env } from './config/env.js';

const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Stopping SIARE API');
  await app.close();
  await closeDatabase();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: env.host, port: env.port });
} catch (error) {
  app.log.fatal(error);
  await closeDatabase();
  process.exit(1);
}
