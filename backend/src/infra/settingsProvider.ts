import { prisma } from './prisma.js';

/**
 * Credencial e configuração de integração: valor do banco (`integration_settings`, editável em
 * Admin → Integrações) com precedência sobre a env var.
 *
 * **O cache foi acrescentado quando o provedor de pagamento passou a ser lido daqui.** Antes
 * era uma consulta ao banco por chamada, o que estava bem para credencial lida uma vez por
 * cobrança — mas o provedor é consultado em todo caminho de pagamento, e uma consulta extra
 * por requisição no caminho mais sensível do sistema não se paga.
 *
 * 30 s é o mesmo TTL que o backend do OpenDriver já usa (`infra/settings.ts`), e é a troca
 * explícita que isso implica: mudar uma credencial na tela leva até meio minuto para valer em
 * todas as instâncias. Para não pagar essa espera na própria tela, `updateSetting` limpa o
 * cache local — o atraso só existe entre instâncias diferentes.
 */
const TTL_MS = 30_000;
const cache = new Map<string, { value: string | null; at: number }>();

/** Convenção do `.env`: "Namespace:Chave" vira "Namespace__Chave" (ex.: `Asaas__ApiKey`). */
function envValue(key: string): string | null {
  const env = process.env[key.replace(/:/g, '__')] ?? process.env[key];
  return env && env.trim() !== '' ? env : null;
}

export async function getSetting(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const row = await prisma.integrationSetting.findUnique({ where: { key } });
  const value = row && row.value.trim() !== '' ? row.value : envValue(key);

  cache.set(key, { value, at: Date.now() });
  return value;
}

/**
 * Esquece o que está em cache. Chamado por `updateSetting` para a mudança valer na hora nesta
 * instância, e pelos testes, que trocam configuração entre casos.
 */
export function clearSettingsCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}
