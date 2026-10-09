import { Knex } from 'knex';
import { env } from '../config/env';

export const config: Knex.Config = {
  client: 'pg',
  connection: {
    host: env.db.host,
    port: env.db.port,
    database: env.db.name,
    user: env.db.username,
    password: env.db.password,
  },
  pool: {
    max: env.db.poolMax,
  },

  migrations: {
    directory: env.db.migrationDirectory,
    extension: env.db.migrationExtension,
  },
};
