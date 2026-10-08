import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/errors.js';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { clearSettingsCache } from '../src/infra/settingsProvider.js';
import {
  compraDaReferencia,
  criarCobrancaPix,
  referenciaDeCompra,
} from '../src/infra/adCreditCharges.js';

/**
 * Cobrança Pix de crédito de veiculação, pedida pelo OpenAd.
 *
 * Prisma falso e `fetch` falso: sem Docker e sem tocar no Asaas. O que precisa de prova aqui é o
 * **portão do provedor** (em `mock` não se emite código Pix que o banco do anunciante não
 * reconhece), a exigência de CPF, e o corpo exato enviado ao provedor — é ele que amarra o
 * pagamento à compra do outro serviço.
 */

const COMPRA = '11111111-1111-4111-8111-111111111111';
const USUARIO = '22222222-2222-4222-8222-222222222222';

const settings = new Map<string, string>();
let usuario: {
  id: string;
  name: string;
  email: string;
  cpf: string | null;
  phone: string | null;
} | null = null;

__setPrismaForTests({
  integrationSetting: {
    findUnique: async ({ where }: { where: { key: string } }) => {
      const value = settings.get(where.key);
      return value === undefined ? null : { key: where.key, value };
    },
  },
  user: { findUnique: async () => usuario },
} as unknown as PrismaClient);

/** Chamadas ao Asaas, em ordem, para checar o que foi enviado. */
let chamadas: { url: string; body: Record<string, unknown> | null }[] = [];
const fetchOriginal = globalThis.fetch;

function responder(url: string): Response {
  const corpo = (dados: unknown, status = 200) =>
    new Response(JSON.stringify(dados), { status, headers: { 'Content-Type': 'application/json' } });

  if (url.endsWith('/customers')) return corpo({ id: 'cus_1' });
  if (url.endsWith('/pixQrCode')) {
    return corpo({ payload: '00020126-copia-e-cola', expirationDate: '2026-10-09 12:00:00' });
  }
  if (url.endsWith('/payments')) return corpo({ id: 'pay_1', status: 'PENDING' });
  return corpo({ errors: [{ description: 'rota nao esperada no teste' }] }, 404);
}

beforeEach(() => {
  settings.clear();
  /**
   * `getSetting` tem cache de 30 s. Sem limpar, o `Payments:Provider` de um caso vazaria para o
   * seguinte e o portão do provedor seria testado contra o valor errado.
   */
  clearSettingsCache();
  chamadas = [];
  usuario = {
    id: USUARIO,
    name: 'Anunciante Teste',
    email: 'anunciante@teste.com',
    cpf: '12345678909',
    phone: '67999990000',
  };
  settings.set('Payments:Provider', 'asaas');
  settings.set('Asaas:ApiKey', 'chave-de-teste');
  settings.set('Asaas:Environment', 'sandbox');

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    let body: Record<string, unknown> | null = null;
    if (typeof init?.body === 'string') body = JSON.parse(init.body) as Record<string, unknown>;
    chamadas.push({ url, body });
    return responder(url);
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = fetchOriginal;
  vi.restoreAllMocks();
});

const pedir = () =>
  criarCobrancaPix({
    purchaseId: COMPRA,
    userId: USUARIO,
    amountCents: 90_000,
    description: 'Credito de veiculacao OpenAd',
  });

describe('referência da compra', () => {
  it('ida e volta', () => {
    expect(compraDaReferencia(referenciaDeCompra(COMPRA))).toBe(COMPRA);
  });

  it('referência de pedido do hub não é confundida com crédito', () => {
    // `DH-...` é o formato de `paymentCodes.reference(orderId)`. Se passasse por crédito, o
    // webhook chamaria o OpenAd com o id de um pedido do hub.
    expect(compraDaReferencia('DH-abc-123')).toBeNull();
    expect(compraDaReferencia(null)).toBeNull();
    expect(compraDaReferencia(undefined)).toBeNull();
  });

  it('referência marcada mas com conteúdo inválido é recusada', () => {
    /**
     * A referência vem de fora — é texto que o Asaas devolve. Sem a conferência de UUID, um
     * valor adulterado entraria na URL da chamada ao OpenAd.
     */
    expect(compraDaReferencia('OA-../../admin')).toBeNull();
    expect(compraDaReferencia('OA-')).toBeNull();
  });
});

describe('criarCobrancaPix', () => {
  it('em mock recusa em vez de simular', async () => {
    settings.set('Payments:Provider', 'mock');
    /**
     * O gateway simulado gera QR falso e aprova sozinho depois de 5 minutos. Num pedido de
     * desenvolvimento isso é útil; num crédito de veiculação o anunciante receberia um código
     * que o banco dele não reconhece e ficaria tentando pagar.
     */
    await expect(pedir()).rejects.toMatchObject({ statusCode: 503 });
    expect(chamadas).toHaveLength(0);
  });

  it('sem CPF recusa antes de criar nada no provedor', async () => {
    usuario = { ...usuario!, cpf: null };
    /**
     * Não cai para `Asaas:DefaultCpfCnpj` de propósito: aquele é um CPF de teste, e usá-lo numa
     * cobrança real emitiria um Pix no nome de outra pessoa.
     */
    await expect(pedir()).rejects.toMatchObject({ statusCode: 400 });
    expect(chamadas).toHaveLength(0);
  });

  it('usuário inexistente é 404', async () => {
    usuario = null;
    await expect(pedir()).rejects.toBeInstanceOf(AppError);
    // Nenhuma chamada ao provedor: o pagador é conferido antes.
    expect(chamadas.filter((c) => c.url.includes('/payments'))).toHaveLength(0);
  });

  it('envia valor em reais e referência marcada, sem split', async () => {
    const r = await pedir();

    const pagamento = chamadas.find((c) => c.url.endsWith('/payments'));
    expect(pagamento?.body).toMatchObject({
      customer: 'cus_1',
      billingType: 'PIX',
      // Centavos → reais acontece **só** nesta fronteira; do lado do OpenAd o dinheiro é inteiro.
      value: 900,
      externalReference: `OA-${COMPRA}`,
    });
    /**
     * Sem `split`: o crédito é receita da plataforma e o repasse ao motorista sai depois, por
     * veiculação. Dividir aqui pagaria o motorista por um anúncio que ainda não tocou.
     */
    expect(pagamento?.body).not.toHaveProperty('split');

    expect(r.externalId).toBe('pay_1');
    expect(r.copyPaste).toBe('00020126-copia-e-cola');
    expect(r.expiresAt).toBe(new Date('2026-10-09 12:00:00').toISOString());
  });

  it('cria o cliente com o CPF do cadastro', async () => {
    await pedir();
    const cliente = chamadas.find((c) => c.url.endsWith('/customers'));
    expect(cliente?.body).toMatchObject({
      cpfCnpj: '12345678909',
      email: 'anunciante@teste.com',
      externalReference: USUARIO,
    });
  });

  it('QR ausente falha em vez de devolver cobrança sem código', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/pixQrCode')) return new Response('{}', { status: 500 });
      return original(input, init);
    }) as typeof fetch;

    /**
     * O anunciante está na tela esperando o código. Devolver sucesso sem ele o deixaria
     * aguardando um pagamento que não tem como fazer; a cobrança órfã vence no mesmo dia.
     */
    await expect(pedir()).rejects.toMatchObject({ statusCode: 502 });
  });

  it('erro do Asaas na cobrança vira 502 com a mensagem do provedor', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/payments')) {
        return new Response(JSON.stringify({ errors: [{ description: 'valor invalido' }] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return original(input, init);
    }) as typeof fetch;

    await expect(pedir()).rejects.toMatchObject({ statusCode: 502, message: /valor invalido/ });
  });
});
