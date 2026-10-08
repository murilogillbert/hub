import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { clearSettingsCache } from '../src/infra/settingsProvider.js';

/**
 * Fan-out do pagamento de crédito de veiculação: hub → OpenAd.
 *
 * O ponto em prova é que a decisão sai da **resposta do Asaas**, não do corpo do webhook. Um
 * POST forjado com a referência de uma compra real e `status: RECEIVED` creditaria saldo de graça
 * se a decisão saísse do corpo; o token do webhook barra isso, mas autenticação e autorização são
 * camadas diferentes — o token diz quem chamou, não que o conteúdo é verdade.
 */

const confirmar = vi.fn();
const estornar = vi.fn();
vi.mock('../src/infra/openadCredit.js', () => ({
  confirmarCredito: (id: string, ext: string) => confirmar(id, ext),
  estornarCredito: (id: string, motivo: string) => estornar(id, motivo),
}));

const adCreditService = await import('../src/services/adCreditService.js');

const COMPRA = '33333333-3333-4333-8333-333333333333';

const settings = new Map<string, string>();
__setPrismaForTests({
  integrationSetting: {
    findUnique: async ({ where }: { where: { key: string } }) => {
      const value = settings.get(where.key);
      return value === undefined ? null : { key: where.key, value };
    },
  },
} as unknown as PrismaClient);

const fetchOriginal = globalThis.fetch;
/** O que a consulta ao Asaas devolve para `GET payments/:id`. */
let pagamentoNoAsaas: Record<string, unknown> | null = null;

beforeEach(() => {
  settings.clear();
  clearSettingsCache();
  confirmar.mockReset();
  estornar.mockReset();
  settings.set('Payments:Provider', 'asaas');
  settings.set('Asaas:ApiKey', 'chave-de-teste');

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (/\/payments\/[^/]+$/.test(url)) {
      if (!pagamentoNoAsaas) return new Response('{}', { status: 404 });
      return new Response(JSON.stringify(pagamentoNoAsaas), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  pagamentoNoAsaas = null;
});

describe('tratarPagamentoSemPedido', () => {
  it('pagamento aprovado confirma o crédito no OpenAd', async () => {
    pagamentoNoAsaas = { id: 'pay_1', status: 'RECEIVED', externalReference: `OA-${COMPRA}` };
    const r = await adCreditService.tratarPagamentoSemPedido('pay_1');
    expect(r).toBe('openad_credit_confirmed');
    expect(confirmar).toHaveBeenCalledWith(COMPRA, 'pay_1');
    expect(estornar).not.toHaveBeenCalled();
  });

  it('CONFIRMED também é aprovado', async () => {
    // `mapStatus` é compartilhado com o fluxo de pedidos de propósito: duas cópias da tabela de
    // status divergiriam no primeiro status novo que o Asaas introduzisse.
    pagamentoNoAsaas = { id: 'pay_1', status: 'CONFIRMED', externalReference: `OA-${COMPRA}` };
    expect(await adCreditService.tratarPagamentoSemPedido('pay_1')).toBe('openad_credit_confirmed');
  });

  it('devolução estorna com o status do provedor como motivo', async () => {
    pagamentoNoAsaas = { id: 'pay_1', status: 'REFUNDED', externalReference: `OA-${COMPRA}` };
    const r = await adCreditService.tratarPagamentoSemPedido('pay_1');
    expect(r).toBe('openad_credit_refunded');
    expect(estornar).toHaveBeenCalledWith(COMPRA, 'Asaas: REFUNDED');
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('evento intermediário não lança nada', async () => {
    /**
     * O Asaas avisa de cobrança criada e de cobrança vencida. Responder erro faria o provedor
     * reenviar para sempre um evento que não tem desfecho.
     */
    pagamentoNoAsaas = { id: 'pay_1', status: 'PENDING', externalReference: `OA-${COMPRA}` };
    expect(await adCreditService.tratarPagamentoSemPedido('pay_1')).toBe('openad_credit_pending');
    expect(confirmar).not.toHaveBeenCalled();
    expect(estornar).not.toHaveBeenCalled();
  });

  it('referência que não é do OpenAd devolve null e não chama nada', async () => {
    // É o caminho de um pedido do hub que não casou por outro motivo. Devolver `null` mantém o
    // resultado `ignored` que o conciliador já produzia.
    pagamentoNoAsaas = { id: 'pay_1', status: 'RECEIVED', externalReference: 'DH-pedido-123' };
    expect(await adCreditService.tratarPagamentoSemPedido('pay_1')).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('pagamento sem referência devolve null', async () => {
    pagamentoNoAsaas = { id: 'pay_1', status: 'RECEIVED' };
    expect(await adCreditService.tratarPagamentoSemPedido('pay_1')).toBeNull();
  });

  it('id desconhecido no provedor devolve null', async () => {
    pagamentoNoAsaas = null;
    expect(await adCreditService.tratarPagamentoSemPedido('pay_inexistente')).toBeNull();
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('com provedor diferente de asaas nem consulta', async () => {
    settings.set('Payments:Provider', 'mercadopago');
    clearSettingsCache();
    const espiao = vi.spyOn(globalThis, 'fetch');
    expect(await adCreditService.tratarPagamentoSemPedido('pay_1')).toBeNull();
    // Importa porque este caminho roda em **todo** webhook de pagamento sem pedido: uma consulta
    // ao Asaas por evento do Mercado Pago seria tráfego inútil num fluxo que não é nosso.
    expect(espiao).not.toHaveBeenCalled();
  });

  it('o status vem do provedor, não do corpo do webhook', async () => {
    /**
     * O corpo diria `RECEIVED`; o provedor diz `PENDING`. Nada é creditado. É a garantia que
     * impede um POST forjado de virar saldo — o webhook nunca passa o status adiante, só o id.
     */
    pagamentoNoAsaas = { id: 'pay_1', status: 'PENDING', externalReference: `OA-${COMPRA}` };
    const r = await adCreditService.tratarPagamentoSemPedido('pay_1');
    expect(r).toBe('openad_credit_pending');
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('falha ao lançar no OpenAd propaga, para o Asaas reenviar', async () => {
    pagamentoNoAsaas = { id: 'pay_1', status: 'RECEIVED', externalReference: `OA-${COMPRA}` };
    confirmar.mockRejectedValueOnce(new Error('openad fora do ar'));
    /**
     * Propagar é o comportamento certo: o dinheiro já entrou e o crédito tem de aparecer. A
     * retentativa do provedor é a fila de reprocessamento, e a rota do OpenAd é idempotente.
     * Engolir o erro deixaria um Pix pago sem crédito e sem nada tentando de novo.
     */
    await expect(adCreditService.tratarPagamentoSemPedido('pay_1')).rejects.toThrow('openad fora do ar');
  });
});
