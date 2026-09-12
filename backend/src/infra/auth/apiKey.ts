import crypto from 'node:crypto';

const PREFIX = 'odh_svc_';

/** Gera uma chave de API de serviço (alta entropia) — só existe em texto puro
 * uma vez, na resposta da criação; depois disso só o hash fica guardado. */
export function generateApiKey(): { key: string; hashedKey: string; keyPreview: string } {
  const key = `${PREFIX}${crypto.randomBytes(32).toString('hex')}`;
  return { key, hashedKey: hashApiKey(key), keyPreview: `${key.slice(0, 12)}…` };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}
