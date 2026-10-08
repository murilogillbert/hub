import { config } from '../config.js';
import { AppError } from '../errors.js';
import { getSetting } from './settingsProvider.js';

/**
 * Chamada do hub para o OpenAd quando um pagamento de crédito de veiculação muda de estado.
 *
 * ============================================================================
 * Por que o hub avisa, e não o OpenAd pergunta
 * ============================================================================
 *
 * Porque é o hub que recebe o webhook do Asaas — a conta do provedor é dele. O OpenAd não tem
 * como saber que o Pix foi pago a não ser perguntando em laço, e um laço de consulta por compra
 * pendente seria tráfego constante para descobrir algo que já chegou aqui pronto.
 *
 * ============================================================================
 * Falha é alta, não silenciosa
 * ============================================================================
 *
 * Diferente de `accountSync`, que recusa a operação quando o outro serviço não responde, aqui o
 * dinheiro **já entrou**: o anunciante pagou e o crédito tem de aparecer. Lançar é o que faz o
 * webhook responder erro ao Asaas, e o Asaas reenvia — a retentativa do provedor é a nossa fila
 * de reprocessamento. Engolir o erro aqui deixaria um Pix pago sem crédito lançado, e sem nada
 * tentando de novo.
 *
 * A rota do OpenAd é idempotente (`referenceId` único no livro-caixa), então reenvio não credita
 * duas vezes.
 */
const TIMEOUT_MS = 10_000;

/**
 * Chave de serviço para falar com o OpenAd.
 *
 * `Internal:AccountSyncKey` é a mesma chave que já serve a exclusão de conta, e os três serviços
 * validam contra a **mesma** `service_api_keys`. Emitir uma segunda chave só para o crédito
 * dobraria o número de segredos a rotacionar sem reduzir o alcance de nenhum deles: quem tem
 * uma já alcança os dois destinos.
 *
 * O que muda é o **escopo**: a chave precisa de `ads:credit:write` além de `account:*`. Sem
 * ele o OpenAd responde 403 e a confirmação não passa — ver a descrição do grupo em
 * `settingsService.ts`.
 */
async function credenciais(): Promise<{ base: string; key: string }> {
  const base = (await getSetting('OpenAd:ApiUrl')) ?? config.openadApiUrl;
  const key = await getSetting('Internal:AccountSyncKey');
  if (!base || !key) {
    throw new AppError(
      'OpenAd:ApiUrl (ou OPENAD_API_URL) e Internal:AccountSyncKey são obrigatórios para lançar crédito de veiculação.',
      503,
    );
  }
  return { base: base.replace(/\/+$/, ''), key };
}

async function post(path: string, body: unknown): Promise<void> {
  const { base, key } = await credenciais();
  let res: Response;
  try {
    res = await fetch(`${base}/api/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error('openadCredit: OpenAd inacessível', path, (err as Error).message);
    throw new AppError('OpenAd inacessível para lançar o crédito de veiculação.', 502);
  }
  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    console.error('openadCredit: OpenAd respondeu', res.status, corpo.slice(0, 400));
    throw new AppError(`OpenAd recusou o lançamento de crédito (HTTP ${res.status}).`, 502);
  }
}

/** Confirma o pagamento e credita o saldo do anunciante. Idempotente no OpenAd. */
export async function confirmarCredito(purchaseId: string, externalId: string): Promise<void> {
  await post(`/internal/ads/credits/${encodeURIComponent(purchaseId)}/confirm`, { externalId });
}

/** Estorno: lançamento compensatório no livro-caixa do OpenAd. Idempotente. */
export async function estornarCredito(purchaseId: string, motivo: string): Promise<void> {
  await post(`/internal/ads/credits/${encodeURIComponent(purchaseId)}/refund`, { motivo });
}
