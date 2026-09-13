import crypto from 'node:crypto';
import type { AuthTokenPurpose } from '@prisma/client';
import { prisma } from '../prisma.js';

function hash(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/** Gera um token de uso único (verificação de e-mail / redefinição de senha).
 * Só o hash SHA-256 é persistido — o token bruto só existe no link do e-mail.
 * Invalida qualquer token pendente anterior do mesmo (usuário, propósito). */
export async function issueToken(userId: string, purpose: AuthTokenPurpose, ttlMs: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: { userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hash(rawToken),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    }),
  ]);
  return rawToken;
}

/** Consome um token de uso único: válido só se existir, não tiver sido usado
 * e não estiver expirado. Retorna o userId dono do token, ou null. */
export async function consumeToken(rawToken: string, purpose: AuthTokenPurpose): Promise<string | null> {
  const tokenHash = hash(rawToken);
  const row = await prisma.authToken.findUnique({ where: { tokenHash } });
  if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) return null;

  await prisma.authToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}
