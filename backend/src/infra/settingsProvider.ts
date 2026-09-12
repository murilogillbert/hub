import { prisma } from './prisma.js';

/** Resolve uma credencial: valor do banco (se houver) senão a env var. */
export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.integrationSetting.findUnique({ where: { key } });
  if (row && row.value.trim() !== '') return row.value;
  // Convenção do .env: "Namespace:Chave" vira "Namespace__Chave" (ex.: Asaas__ApiKey).
  const env = process.env[key.replace(/:/g, '__')] ?? process.env[key];
  return env && env.trim() !== '' ? env : null;
}
