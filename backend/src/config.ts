import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// .env único na raiz do monorepo (mesmo arquivo que o front usa para
// VITE_API_BASE_URL) — funciona independentemente do cwd (`npm run dev`
// dentro de backend/, ou a partir da raiz).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function parseIntEnv(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value.toLowerCase() === 'true';
}

export const config = {
  port: parseIntEnv(process.env.PORT, 5000),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-secret-change-me-please-32bytes-min',
    issuer: 'opendriverhub',
    audience: 'opendriverhub',
    accessTtlSeconds: parseIntEnv(process.env.JWT_ACCESS_TTL_SECONDS, 2 * 60 * 60),
    refreshTtlSeconds: parseIntEnv(process.env.JWT_REFRESH_TTL_SECONDS, 7 * 24 * 60 * 60),
  },
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? 'mock').toLowerCase(),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  rateLimit: {
    authPermitLimit: parseIntEnv(process.env.RATE_LIMIT_AUTH_PERMIT, 5),
    authWindowSeconds: parseIntEnv(process.env.RATE_LIMIT_AUTH_WINDOW_SECONDS, 60),
  },
  seed: {
    enabled: parseBoolEnv(process.env.SEED_ENABLED, false),
    adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@opendriverhub.com',
    adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Bababobo!@#',
  },
  webhook: {
    requireSignature: parseBoolEnv(process.env.PAYMENT_WEBHOOK_REQUIRE_SIGNATURE, true),
    toleranceSeconds: parseIntEnv(process.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS, 300),
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? 'uploads',
  },
  uploads: {
    maxImageBytes: parseIntEnv(process.env.STORAGE_MAX_IMAGE_BYTES, 5 * 1024 * 1024),
  },
};
