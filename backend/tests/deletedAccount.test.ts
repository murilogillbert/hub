import type { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearAccountStatusCache, DELETED_EMAIL_SUFFIX } from '../src/infra/auth/accountStatus.js';
import { issueTokens } from '../src/infra/auth/jwt.js';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { requireAuth } from '../src/middleware/auth.js';
import { refresh } from '../src/services/authService.js';

/**
 * Conta excluída pelo app OpenDriver (mesmo banco/JWT): e-mail anonimizado
 * com sufixo fixo. Tokens emitidos antes da exclusão não podem continuar
 * valendo nem renovando no hub. Prisma falso: não precisa de Docker.
 */
const users = new Map<string, { id: string; name: string; email: string; role: string; partnerId: null }>();
const fakePrisma = {
  user: {
    findUnique: async ({ where }: { where: { id: string } }) => {
      const u = users.get(where.id);
      return u ? { ...u, passwordHash: 'x', cashbackBalance: { toNumber: () => 0 }, avatarUrl: null, phone: null, cpf: null, emailVerifiedAt: null, createdAt: new Date() } : null;
    },
  },
} as unknown as PrismaClient;

const authUser = (id: string) => ({ id, name: 'Ana', email: `${id}@example.com`, role: 'Passenger', partnerId: null });

async function runRequireAuth(token: string): Promise<'next' | number> {
  const req = { headers: { authorization: `Bearer ${token}` } } as Request;
  let result: 'next' | number = 0;
  try {
    await requireAuth(req, {} as Response, (() => (result = 'next')) as NextFunction);
  } catch (e) {
    result = (e as { statusCode?: number; status?: number }).statusCode ?? (e as { status?: number }).status ?? 500;
  }
  return result;
}

describe('sessão de conta excluída pelo OpenDriver', () => {
  beforeEach(() => {
    users.clear();
    clearAccountStatusCache();
    __setPrismaForTests(fakePrisma);
  });

  it('conta ativa: acesso e refresh funcionam', async () => {
    users.set('u1', { ...authUser('u1') });
    const t = issueTokens(authUser('u1'));
    expect(await runRequireAuth(t.token)).toBe('next');
    expect((await refresh(t.refreshToken)).user.id).toBe('u1');
  });

  it('conta excluída: token de acesso e refresh deixam de valer', async () => {
    users.set('u2', { ...authUser('u2'), name: 'Conta excluída', email: `excluido+u2${DELETED_EMAIL_SUFFIX}` });
    const t = issueTokens(authUser('u2'));
    expect(await runRequireAuth(t.token)).toBe(401);
    await expect(refresh(t.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });
});
