/**
 * Cliente da API do OpenAd para o **painel de crédito do anunciante**.
 *
 * ============================================================================
 * Por que este painel vive no hub, e não no portal do OpenAd
 * ============================================================================
 *
 * Porque o token é daqui. A API do OpenAd aceita duas origens de identidade: a interna
 * (`openad.users`, pessoal de operação) e a **federada** — um JWT emitido pelo hub, validado
 * com o mesmo `JWT_SECRET`, `issuer` e `audience`. O anunciante não tem linha em
 * `openad.users`, então não consegue token no portal do OpenAd de jeito nenhum. Já o token que
 * este painel guarda em `localStorage` é exatamente o que o OpenAd aceita.
 *
 * ============================================================================
 * Por que a compra é na web, e não no app
 * ============================================================================
 *
 * Decisão de 2026-10-07: compra dentro do app exigiria in-app purchase pela política do Google,
 * com taxa de 15 a 30%. Numa operação cujo preço unitário é R$ 0,045 por exibição, isso sai do
 * que sobra para a plataforma e para o motorista. O app do anunciante só gerencia; a compra
 * acontece aqui.
 *
 * Mesmo padrão de `features/opendriver/api.ts`: cliente próprio porque a base é outra, token
 * compartilhado porque a sessão é a mesma, e renovação **delegada ao hub** — a API do OpenAd
 * tem `/auth/refresh`, mas ela responde 401 para refresh token do hub, e chamá-la deslogaria o
 * anunciante a cada 2 h com a sessão perfeitamente válida.
 */
import { api as hubApi, ApiError, tokenStore } from '@shared/api/client';

const ORIGIN = (import.meta.env.VITE_OPENAD_API_URL ?? '').replace(/\/+$/, '');
const BASE = `${ORIGIN}/api/v1`;

export const openadConfigured = ORIGIN.length > 0;

async function send(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  if (!openadConfigured) {
    throw new ApiError('API do OpenAd não configurada (VITE_OPENAD_API_URL).', 0);
  }
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && retry && tokenStore.getRefresh()) {
    // Uma chamada autenticada ao hub renova o token (ou encerra a sessão).
    await hubApi.get('/auth/me').catch(() => undefined);
    return send(path, init, false);
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as
      | { error?: { message?: string; code?: string } | string }
      | null;
    /**
     * O OpenAd responde `{ error: { code, message } }`; o hub responde `{ error: '<texto>' }`.
     * Tratar os dois formatos aqui evita que a tela mostre "Erro 400" quando o servidor
     * explicou o motivo — e é na mensagem que está a instrução ("cadastre o CPF", "o valor
     * mínimo é R$ 20").
     */
    const erro = json?.error;
    const mensagem =
      typeof erro === 'string'
        ? erro
        : erro?.message ?? 'Não foi possível concluir. Tente novamente.';
    throw new ApiError(mensagem, res.status);
  }
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await send(path, init);
  if (res.status === 204) return undefined as T;
  const body = (await res.json()) as { data?: unknown } | null;
  return ((body && typeof body === 'object' && 'data' in body ? body.data : body) ?? null) as T;
}

// --------------------------------------------------------------------------------- tipos

export interface SituacaoDeAdesao {
  conta: { userId: string; email: string; name: string };
  anunciante: { advertiserId: string; legalName: string; status: string } | null;
  precisaAderir: boolean;
}

export interface SaldoDeCredito {
  totalMicros: number;
  retidoMicros: number;
  disponivelMicros: number;
  total: number;
  retido: number;
  disponivel: number;
  currency: string;
}

export interface LinhaDoExtrato {
  id: string;
  direction: 'credit' | 'debit';
  reason: string;
  amountMicros: number;
  amount: number;
  campaignId: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface CompraDeCredito {
  purchaseId: string;
  store: string;
  status: 'pending' | 'validated' | 'refunded' | string;
  amountCents: number;
  amount: number;
  creditMicros: number;
  pixCopyPaste: string | null;
  pixExpiresAt: string | null;
  chargeExternalId: string | null;
  createdAt: string;
  validatedAt: string | null;
  refundedAt: string | null;
}

export interface TabelaDePreco {
  pricePerSecondMicros: number;
  pricePerSecond: number;
  minimumCents: number;
  maximumCents: number;
  byDuration: { seconds: number; costMicros: number; cost: number }[];
}

export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ------------------------------------------------------------------------------ chamadas

export const anuncianteApi = {
  /**
   * Situação da adesão.
   *
   * Precisa vir **antes** de qualquer outra chamada: as rotas de `/advertiser/*` exigem linha
   * em `openad.ad_advertisers` e respondem **401** (não 403) para conta sem adesão. Sem
   * consultar isto primeiro, o 401 passaria pelo tratamento de sessão expirada e deslogaria
   * quem está perfeitamente logado.
   */
  adesao: (signal?: AbortSignal) =>
    json<SituacaoDeAdesao>('/advertiser/onboarding', { method: 'GET', signal }),

  aderir: (legalName?: string) =>
    json<{ advertiserId: string; criado: boolean }>('/advertiser/onboarding', {
      method: 'POST',
      body: JSON.stringify(legalName ? { legalName } : {}),
    }),

  saldo: (signal?: AbortSignal) =>
    json<SaldoDeCredito>('/advertiser/credits/balance', { method: 'GET', signal }),

  tabela: (signal?: AbortSignal) =>
    json<TabelaDePreco>('/advertiser/credits/pricing', { method: 'GET', signal }),

  extrato: (page = 1, limit = 20, signal?: AbortSignal) =>
    json<Pagina<LinhaDoExtrato>>(`/advertiser/credits/ledger?page=${page}&limit=${limit}`, {
      method: 'GET',
      signal,
    }),

  compras: (page = 1, limit = 10, signal?: AbortSignal) =>
    json<Pagina<CompraDeCredito>>(`/advertiser/credits/purchases?page=${page}&limit=${limit}`, {
      method: 'GET',
      signal,
    }),

  comprarComPix: (amountCents: number) =>
    json<CompraDeCredito>('/advertiser/credits/pix', {
      method: 'POST',
      body: JSON.stringify({ amountCents }),
    }),
};

/** Motivo do lançamento em texto, para o extrato não mostrar o enum do banco. */
export const MOTIVO: Record<string, string> = {
  purchase: 'Compra de crédito',
  campaign_spend: 'Veiculação',
  refund: 'Estorno',
  adjustment: 'Ajuste manual',
};
