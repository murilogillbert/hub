import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors.js';
import { hashApiKey } from '../infra/auth/apiKey.js';
import { prisma } from '../infra/prisma.js';

/** Autentica chamadas servidor-a-servidor (n8n, energia-solar-api, ...) via
 * `Authorization: Bearer <chave>`, checando escopos exigidos pela rota.
 * Equivalente ao requireAuth/requireRole, mas para integrações — não usuários. */
export function requireApiKey(...scopes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    const key = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!key) throw new AppError('Chave de API ausente.', 401);

    const row = await prisma.serviceApiKey.findUnique({ where: { hashedKey: hashApiKey(key) } });
    if (!row || !row.active) throw new AppError('Chave de API inválida.', 401);
    if (!scopes.every((s) => row.scopes.includes(s))) throw new AppError('Chave sem permissão para esta operação.', 403);

    await prisma.serviceApiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    next();
  };
}
