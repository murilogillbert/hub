import { prisma } from '../prisma.js';

/**
 * Contas excluídas pelo app OpenDriver (mesmo banco, mesmo JWT) são
 * anonimizadas com este sufixo de e-mail. JWT é sem estado: sem esta checagem
 * um token emitido antes da exclusão continuaria valendo (e renovando) aqui.
 */
export const DELETED_EMAIL_SUFFIX = '@invalid.opendriver';

export const isDeletedEmail = (email: string) => email.endsWith(DELETED_EMAIL_SUFFIX);

const TTL_MS = 60_000;
const cache = new Map<string, { active: boolean; at: number }>();

/** Usuário existe e não foi excluído (cache curto para não ir ao banco a cada request). */
export async function isUserActive(userId: string): Promise<boolean> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.active;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  const active = !!u && !isDeletedEmail(u.email);
  if (cache.size > 50_000) cache.clear();
  cache.set(userId, { active, at: Date.now() });
  return active;
}

export function clearAccountStatusCache(): void {
  cache.clear();
}
