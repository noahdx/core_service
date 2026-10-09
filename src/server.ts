import 'reflect-metadata';
import http from 'http';
import { createApp } from './app';
import { env } from './lib/config/env';
import { logger } from './lib/logger/logger';
import { db } from './lib/knex/knex';

const app = createApp();
const server = http.createServer(app);

server.listen(env.port, () => {
  logger.info(`Server listening on ${env.port}`);
});

function shutdown() {
  server.close(async () => {
    console.log('Server closed');
    console.log('Database Shutdown');
    await db.destroy();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
