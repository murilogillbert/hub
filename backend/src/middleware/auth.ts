import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.js';
import { verifyAccessToken } from '../infra/auth/jwt.js';

export interface AuthContext {
  userId: string;
  role: string;
  partnerId: string | null;
}

/** Espelha as 3 AuthorizationPolicy do Program.cs original: Admin sempre
 * passa nas policies Client/Partner. */
export const ROLES = {
  client: ['Client', 'Admin'],
  partner: ['Partner', 'Admin'],
  admin: ['Admin'],
  financeiro: ['Financeiro', 'Admin'],
} as const;

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/** Exige um usuário autenticado (qualquer papel). Equivalente a [Authorize]. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) throw new AppError('Não autenticado.', 401);
  try {
    const claims = verifyAccessToken(token);
    req.auth = { userId: claims.sub, role: claims.role, partnerId: claims.partnerId ?? null };
    next();
  } catch {
    throw new AppError('Não autenticado.', 401);
  }
}

/** Exige um dos papéis informados (Admin sempre passa nas policies Client/Partner,
 * espelhando as AuthorizationPolicy do Program.cs original). */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) throw new AppError('Não autenticado.', 401);
    if (!roles.includes(req.auth.role)) throw new AppError('Acesso negado.', 403);
    next();
  };
}

export function userId(req: Request): string {
  if (!req.auth) throw new AppError('Não autenticado.', 401);
  return req.auth.userId;
}

export function partnerId(req: Request): string {
  if (!req.auth?.partnerId) throw new AppError('Usuário não vinculado a um parceiro.', 403);
  return req.auth.partnerId;
}

/** userId do request se autenticado, senão null (rotas públicas que aceitam
 * usuário opcional, como o assistente). */
export function optionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) return null;
  try {
    return verifyAccessToken(token).sub;
  } catch {
    return null;
  }
}
