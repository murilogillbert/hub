import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.js';
import { verifyAccessToken } from '../infra/auth/jwt.js';
import { prisma } from '../infra/prisma.js';

export interface AuthContext {
  userId: string;
  role: string;
  partnerId: string | null;
}

/** Espelha as 3 AuthorizationPolicy do Program.cs original: Admin sempre
 * passa nas policies Client/Partner.
 *
 * client: quem pode comprar/ver pedidos/cashback — Passenger e Driver
 * (o antigo papel Client dividido em dois) + Partner (loja também compra,
 * ver programa de afiliação loja↔motorista) + Client mantido pra sempre
 * como rede de segurança pra token/linha antiga (nunca removido do enum). */
export const ROLES = {
  client: ['Passenger', 'Driver', 'Partner', 'Client', 'Admin'],
  passenger: ['Passenger', 'Admin'],
  driver: ['Driver', 'Admin'],
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

/** Exige e-mail verificado — usado só nas ações que envolvem dinheiro
 * (pagamento, saque). Consulta o banco em vez de confiar numa claim do JWT
 * porque o access token vive até 2h e o usuário pode verificar o e-mail
 * nesse meio-tempo. */
export async function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) throw new AppError('Não autenticado.', 401);
  const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
  if (!user?.emailVerifiedAt)
    throw new AppError('Confirme seu e-mail antes de continuar.', 403);
  next();
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
