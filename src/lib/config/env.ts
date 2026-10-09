/**
 * 1. defined schema with name match .env
 * 2. pass process.env folder to schema to verify it
 * 3. export my object with values
 */
import { z } from 'zod';
import { config } from 'dotenv';
import * as path from 'node:path';

config({ path: path.resolve(__dirname, '../../../.env') });

const schema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.string().default('development'),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().default('5432'),
  DB_NAME: z.string().default('core_service'),
  DB_USERNAME: z.string().default('postgres'),
  DB_PASSWORD: z.string(),
  DB_POOL_MAX: z.string().default('10'),
  DB_MIGRATION_DIRECTORY: z.string().default('src/migrations'),
  DB_MIGRATION_EXTENSION: z.string().default('ts'),

  ACCESS_SECRET: z.string().default('access-secret-default'),
  REFRESH_SECRET: z.string().default('refresh-secret-default'),
  ACCESS_EXPIRES_IN: z.string().default('1h'),
  REFRESH_EXPIRES_IN: z.string().default('1d'),
});

const parsed = schema.parse(process.env);

export const env = {
  port: parsed.PORT,
  isProduction: parsed.NODE_ENV === 'production',
  db: {
    host: parsed.DB_HOST,
    port: Number(parsed.DB_PORT),
    name: parsed.DB_NAME,
    username: parsed.DB_USERNAME,
    password: parsed.DB_PASSWORD,
    poolMax: Number(parsed.DB_POOL_MAX),
    migrationDirectory: path.resolve('../../../', parsed.DB_MIGRATION_DIRECTORY),
    migrationExtension: parsed.DB_MIGRATION_EXTENSION,
  },

  jwt: {
    accessToken: parsed.ACCESS_SECRET,
    refreshToken: parsed.REFRESH_SECRET,
    accessExpiresIn: parsed.ACCESS_EXPIRES_IN,
    refreshExpiresIn: parsed.REFRESH_EXPIRES_IN,
  },
};
