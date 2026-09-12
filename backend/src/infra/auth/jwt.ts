import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  partnerId: string | null;
}

export interface AccessTokenClaims {
  sub: string;
  name: string;
  email: string;
  role: string;
  partnerId?: string;
}

export function issueTokens(user: AuthUser): { token: string; refreshToken: string } {
  const claims: AccessTokenClaims = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
  if (user.partnerId) claims.partnerId = user.partnerId;

  const token = jwt.sign(claims, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    expiresIn: config.jwt.accessTtlSeconds,
    algorithm: 'HS256',
  });

  const refreshToken = createRefreshToken(user.id);
  return { token, refreshToken };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, config.jwt.secret, {
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    algorithms: ['HS256'],
  }) as AccessTokenClaims;
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', config.jwt.secret).update(payload).digest('hex');
}

function createRefreshToken(userId: string): string {
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000).toISOString();
  const payload = `${userId}|${expiresAt}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}|${sig}`, 'utf8').toString('base64');
}

/** Valida o refresh token e retorna o userId, ou null se inválido/expirado. */
export function validateRefreshToken(refreshToken: string): string | null {
  try {
    const raw = Buffer.from(refreshToken, 'base64').toString('utf8');
    const parts = raw.split('|');
    if (parts.length !== 3) return null;
    const [userId, expiresAt, sig] = parts;
    const payload = `${userId}|${expiresAt}`;
    const expected = sign(payload);
    const expectedBuf = Buffer.from(expected, 'utf8');
    const sigBuf = Buffer.from(sig, 'utf8');
    if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf))
      return null;
    if (new Date(expiresAt).getTime() < Date.now()) return null;
    return userId;
  } catch {
    return null;
  }
}
