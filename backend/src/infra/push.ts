import { prisma } from './prisma.js';

/**
 * Push via Expo Push Service — o app mobile (../../hub-mobile) registra o token em
 * POST /me/push-tokens.
 *
 * Fire-and-forget de propósito: falha de push nunca quebra o fluxo que a chamou (pagamento,
 * resgate). O mesmo aviso continua sendo gravado em `notifications`, que é a fonte da verdade e
 * aparece no sino do site e na aba Conta do app.
 *
 * Mesma implementação do OpenDriver (`opendriver/backend/src/infra/push.ts`) — se mexer aqui,
 * considere mexer lá.
 */
export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const enabled = () => process.env.PUSH_ENABLED !== 'false' && process.env.NODE_ENV !== 'test';

export async function sendPush(userId: string, msg: PushMessage): Promise<void> {
  if (!enabled()) return;
  try {
    const tokens = await prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
    if (!tokens.length) return;
    const body = tokens.map((t) => ({
      to: t.token,
      title: msg.title,
      body: msg.body,
      data: msg.data ?? {},
      sound: 'default',
      priority: 'default',
      channelId: 'default',
      ttl: 3600,
    }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
    // Remove tokens que o Expo diz não existirem mais (app desinstalado).
    const dead = (json?.data ?? [])
      .map((r, i) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? tokens[i]?.token : null))
      .filter((t): t is string => !!t);
    if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
  } catch (err) {
    console.warn('Falha ao enviar push', (err as Error).message);
  }
}
