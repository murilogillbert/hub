import { config } from '../config.js';
import { AppError } from '../errors.js';
import { getSetting } from './settingsProvider.js';

/**
 * Chamada servidor-a-servidor para o OpenDriver, usada na exclusão de conta.
 *
 * Os dois serviços compartilham `public.users` mas são donos de schemas diferentes, então nenhum
 * dos dois apaga a tabela do outro: cada um expõe `/internal/accounts/:id/...` e o que recebe o
 * pedido da pessoa orquestra os dois lados.
 *
 * Autenticação pela mesma `service_api_keys` que as outras integrações já usam (hash no banco,
 * escopos, revogável no Admin → Chaves de API). O valor em texto puro fica em
 * `integration_settings` sob `Internal:AccountSyncKey`, para poder rotacionar sem redeploy.
 *
 * **Fail closed de propósito**: sem URL ou sem chave, a exclusão é recusada em vez de apagar só
 * metade. Conta anonimizada com dado pessoal sobrando no outro schema seria o pior resultado.
 */
const UNAVAILABLE = 'Exclusão de conta temporariamente indisponível. Tente mais tarde ou fale com o suporte.';
const TIMEOUT_MS = 10_000;

/**
 * Nos testes não existe um OpenDriver de verdade no ar, e cada suíte verifica o seu próprio lado.
 * Fora de teste NUNCA é desligado: é justamente o fail-closed que impede a exclusão pela metade.
 *
 * A orquestração entre os dois serviços não tem teste automatizado — exigiria subir os dois. O
 * contrato inteiro está em `../../docs/normalizacao-banco.md`.
 */
const skip = () => process.env.NODE_ENV === 'test';

/** Serviços do ecossistema que o hub chama na exclusão de conta. */
type Servico = 'opendriver' | 'openad';

const BASE_DE: Record<Servico, () => string> = {
  opendriver: () => config.opendriverApiUrl,
  openad: () => config.openadApiUrl,
};

const ENV_DE: Record<Servico, string> = {
  opendriver: 'OPENDRIVER_API_URL',
  openad: 'OPENAD_API_URL',
};

async function call(servico: Servico, path: string, method: 'GET' | 'POST'): Promise<unknown> {
  const base = BASE_DE[servico]();
  /**
   * A mesma chave para os dois serviços, de propósito.
   *
   * `Internal:AccountSyncKey` é uma linha de `service_api_keys` com os escopos
   * `account:read` e `account:purge`; os dois destinos validam contra a **mesma** loja de
   * chaves, porque o banco é compartilhado. Emitir uma chave por serviço dobraria o número
   * de segredos a rotacionar sem reduzir o alcance de nenhum deles — quem tem a chave já
   * alcança os dois de qualquer forma.
   */
  const key = await getSetting('Internal:AccountSyncKey');
  if (!base || !key) {
    console.error(`accountSync: ${ENV_DE[servico]} ou Internal:AccountSyncKey não configurados.`);
    throw new AppError(UNAVAILABLE, 503);
  }
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`accountSync: ${servico} inacessível`, (err as Error).message);
    throw new AppError(UNAVAILABLE, 503);
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    console.error(`accountSync: ${servico} respondeu`, res.status, await res.text().catch(() => ''));
    throw new AppError(UNAVAILABLE, 503);
  }
  const json = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return json && typeof json === 'object' && 'data' in json ? json.data : json;
}

/** Impedimentos do lado do OpenDriver (ex.: corrida em andamento). Lista vazia = pode excluir. */
export async function opendriverDeletionBlockers(userId: string): Promise<string[]> {
  if (skip()) return [];
  return blockersOf('opendriver', userId);
}

/** Apaga os dados do schema `opendriver`. Idempotente: repetir não é erro. */
export async function purgeOpendriverAccount(userId: string): Promise<void> {
  if (skip()) return;
  await call('opendriver', `/internal/accounts/${encodeURIComponent(userId)}/purge`, 'POST');
}

/**
 * Impedimentos do lado do OpenAd (campanha no ar, crédito de veiculação não consumido).
 *
 * Terceiro serviço do ecossistema, acrescentado em 2026-10-03. Antes disso o fan-out era par
 * a par e conhecia só o OpenDriver — apagar uma conta aqui deixava campanha, criativo e livro
 * de crédito do anunciante vivos no `openad`, com `owner_user_id` apontando para um usuário
 * que o titular pediu para remover. Isso é LGPD, não refinamento.
 */
export async function openadDeletionBlockers(userId: string): Promise<string[]> {
  if (skip()) return [];
  return blockersOf('openad', userId);
}

/** Anonimiza o anunciante e arquiva campanha e criativo no schema `openad`. Idempotente. */
export async function purgeOpenadAccount(userId: string): Promise<void> {
  if (skip()) return;
  await call('openad', `/internal/accounts/${encodeURIComponent(userId)}/purge`, 'POST');
}

async function blockersOf(servico: Servico, userId: string): Promise<string[]> {
  const data = (await call(
    servico,
    `/internal/accounts/${encodeURIComponent(userId)}/deletion-blockers`,
    'GET'
  )) as { blockers?: unknown } | null;
  const blockers = data?.blockers;
  return Array.isArray(blockers) ? blockers.filter((b): b is string => typeof b === 'string') : [];
}
