/**
 * 1. defined schema with name match .env
 * 2. pass process.env folder to schema to verify it
 * 3. export my object with values
 */
import { config } from 'dotenv';
import * as path from 'node:path';
import { z } from 'zod';

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

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string(),

  ACCESS_SECRET: z.string().default('access-secret-default'),
  REFRESH_SECRET: z.string().default('refresh-secret-default'),
  ACCESS_EXPIRES_IN: z.string().default('1h'),
  REFRESH_EXPIRES_IN: z.string().default('1d'),

  MJ_API_KEY: z.string(),
  MJ_SECRET_KEY: z.string(),
  FROM_EMAIL: z.string(),
  FROM_NAME: z.string().default('Quick Bit'),

  // Kashier Payment Gateway
  KASHIER_BASE_URL: z.string().default('https://test-api.kashier.io'),
  KASHIER_MERCHANT_ID: z.string().default('MID-XXXX-XXXX'),
  KASHIER_API_KEY: z.string().default('pk_test_xxx'),
  KASHIER_SECRET_KEY: z.string().default('sk_test_xxx'),
  KASHIER_WEBHOOK_SECRET: z.string().default('whsec_xxx'),
  KASHIER_RETURN_URL: z.string().default('https://app.example.com/checkout/return'),
  KASHIER_FAIL_URL: z.string().default('https://app.example.com/checkout/failed'),
  PAYMENT_SESSION_TIMEOUT_MIN: z.string().default('15'),
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
  mailjet: {
    apiKey: parsed.MJ_API_KEY,
    secretKey: parsed.MJ_SECRET_KEY,
    fromEmail: parsed.FROM_EMAIL,
    fromName: parsed.FROM_NAME,
  },
  redis: {
    host: parsed.REDIS_HOST,
    port: Number(parsed.REDIS_PORT),
    password: parsed.REDIS_PASSWORD,
  },
  kashier: {
    baseUrl: parsed.KASHIER_BASE_URL,
    merchantId: parsed.KASHIER_MERCHANT_ID,
    apiKey: parsed.KASHIER_API_KEY,
    secretKey: parsed.KASHIER_SECRET_KEY,
    webhookSecret: parsed.KASHIER_WEBHOOK_SECRET,
    returnUrl: parsed.KASHIER_RETURN_URL,
    failUrl: parsed.KASHIER_FAIL_URL,
    sessionTimeoutMin: Number(parsed.PAYMENT_SESSION_TIMEOUT_MIN),
  },
};
