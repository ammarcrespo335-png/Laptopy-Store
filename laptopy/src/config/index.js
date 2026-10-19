import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters').optional(),
  GOOGLE_CLIENT_ID: z.string().min(10).optional(),
  ADMIN_EMAIL: z.string().email().default('ramezmilab@gmail.com'),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  ANTHROPIC_MODEL: z.string().min(3).default('claude-haiku-5-5'),
  DATA_DIR: z.string().optional(),
  SEED_FILE: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default(''),
  TRUST_PROXY: flag,
  DEV_AUTH: flag,
});

/**
 * Parses and validates environment variables into a frozen config object.
 * Empty values (`KEY=`) are treated as "not set".
 */
export function loadConfig(env = process.env) {
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ''));
  const parsed = envSchema.safeParse(cleaned);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const e = parsed.data;
  const isProd = e.NODE_ENV === 'production';

  if (isProd && !e.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required in production (use: openssl rand -hex 32).');
  }
  if (isProd && e.DEV_AUTH) {
    throw new Error('DEV_AUTH must never be enabled in production.');
  }

  let sessionSecret = e.SESSION_SECRET;
  if (!sessionSecret) {
    sessionSecret = crypto.randomBytes(32).toString('hex');
    if (e.NODE_ENV !== 'test') {
      logger.warn('SESSION_SECRET not set – using a random one (sessions reset on every restart).');
    }
  }

  const dataDir = e.DATA_DIR ? path.resolve(e.DATA_DIR) : path.join(rootDir, 'data');

  return Object.freeze({
    env: e.NODE_ENV,
    isProd,
    port: e.PORT,
    sessionSecret,
    googleClientId: e.GOOGLE_CLIENT_ID ?? null,
    adminEmail: e.ADMIN_EMAIL.trim().toLowerCase(),
    anthropicApiKey: e.ANTHROPIC_API_KEY ?? null,
    anthropicModel: e.ANTHROPIC_MODEL,
    allowedOrigins: e.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    trustProxy: e.TRUST_PROXY,
    devAuth: e.DEV_AUTH,
    rootDir,
    publicDir: path.join(rootDir, 'public'),
    sharedDir: path.join(rootDir, 'shared'),
    dataDir,
    uploadsDir: path.join(dataDir, 'uploads'),
    storeConfigPath: path.join(rootDir, 'config', 'store.json'),
    seedPath: e.SEED_FILE ? path.resolve(e.SEED_FILE) : path.join(rootDir, 'seed', 'laptops.seed.json'),
  });
}
