import type { PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { clearSettingsCache } from '../src/infra/settingsProvider.js';
import { __setPaymentGatewayForTests, getPaymentGateway } from '../src/infra/paymentGateways/index.js';

/**
 * Qual gateway responde, e por quê.
 *
 * Isto existe porque o defeito que a Frente B foi corrigir é **silencioso**: com o provedor em
 * `mock`, o sistema finge que cobra — QR de Pix falso e aprovação automática depois de 5
 * minutos — e nada na interface, no log ou na resposta da API dizia isso. Em produção, as
 * credenciais do Asaas estavam no lugar e o gateway simulado estava respondendo.
 *
 * Os casos abaixo travam as três decisões que fazem a diferença entre cobrar e fingir:
 * precedência do banco sobre a env, queda conservadora para `mock` quando o valor não é
 * reconhecido, e o cache não servir valor velho depois de uma troca.
 *
 * Prisma falso: nada aqui precisa de banco de verdade, e um teste sobre leitura de
 * configuração não deveria exigir Docker.
 */

const settings = new Map<string, string>();

__setPrismaForTests({
  integrationSetting: {
    findUnique: async ({ where }: { where: { key: string } }) => {
      const value = settings.get(where.key);
      return value === undefined ? null : { key: where.key, value };
    },
    // `getGroups` carrega tudo de uma vez para não fazer uma consulta por campo do catálogo,
    // e `getPaymentProviders` filtra por chave. O filtro é respeitado aqui porque ignorá-lo
    // faria o teste passar por um caminho que a produção não percorre.
    findMany: async (args?: { where?: { key?: { in: string[] } } }) => {
      const chaves = args?.where?.key?.in;
      return [...settings.entries()]
        .filter(([key]) => !chaves || chaves.includes(key))
        .map(([key, value]) => ({ key, value }));
    },
  },
} as unknown as PrismaClient);

const envOriginal = {
  provider: process.env.PAYMENT_PROVIDER,
  payments: process.env.Payments__Provider,
};

beforeEach(() => {
  settings.clear();
  clearSettingsCache();
  __setPaymentGatewayForTests(null);
  delete process.env.Payments__Provider;
});

afterEach(() => {
  if (envOriginal.provider === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = envOriginal.provider;
  if (envOriginal.payments === undefined) delete process.env.Payments__Provider;
  else process.env.Payments__Provider = envOriginal.payments;
});

describe('provedor de pagamento', () => {
  it('sem nada configurado, o padrao e simulado', async () => {
    // Conservador de propósito: ambiente novo não começa cobrando de ninguém.
    expect((await getPaymentGateway()).provider).toBe('mock');
  });

  it('o banco tem precedencia sobre a env', async () => {
    process.env.Payments__Provider = 'mock';
    settings.set('Payments:Provider', 'asaas');
    expect((await getPaymentGateway()).provider).toBe('asaas');
  });

  it('a env vale quando o banco nao tem a chave', async () => {
    // É o caminho de compatibilidade: quem já configurava por ambiente continua funcionando.
    process.env.Payments__Provider = 'asaas';
    expect((await getPaymentGateway()).provider).toBe('asaas');
  });

  it('valor nao reconhecido cai em simulado, e nao em cobranca real', async () => {
    /**
     * A queda é para o lado seguro: na dúvida, não cobrar. O que impede a configuração errada
     * de passar despercebida é a validação na escrita e o aviso na tela, não esta queda.
     */
    settings.set('Payments:Provider', 'asas');
    expect((await getPaymentGateway()).provider).toBe('mock');
  });

  it('valor com caixa e espaco e normalizado', async () => {
    settings.set('Payments:Provider', '  Asaas  ');
    expect((await getPaymentGateway()).provider).toBe('asaas');
  });

  it('reconhece o mercado pago, que o hub implementa', async () => {
    settings.set('Payments:Provider', 'mercadopago');
    expect((await getPaymentGateway()).provider).toBe('mercadopago');
  });

  it('o cache nao serve valor velho depois da troca', async () => {
    settings.set('Payments:Provider', 'mock');
    expect((await getPaymentGateway()).provider).toBe('mock');

    settings.set('Payments:Provider', 'asaas');
    // Sem limpar, o cache de 30 s ainda devolveria 'mock' — e é por isso que
    // `updateSetting` limpa a chave que acabou de gravar.
    clearSettingsCache('Payments:Provider');
    expect((await getPaymentGateway()).provider).toBe('asaas');
  });

  it('o stub de teste vence tudo', async () => {
    settings.set('Payments:Provider', 'asaas');
    __setPaymentGatewayForTests({ provider: 'stub' } as never);
    expect((await getPaymentGateway()).provider).toBe('stub');
  });
});

describe('catalogo de configuracao do provedor', () => {
  it('recusa valor fora da lista, em vez de gravar algo que cai em simulado', async () => {
    const { updateSetting } = await import('../src/services/settingsService.js');
    /**
     * Sem esta validação, digitar `asas` não dá erro nenhum: grava, a seleção não reconhece,
     * cai em `mock`, e a tela mostra o valor digitado como se estivesse valendo. É o mesmo
     * modo de falha de antes, só com mais passos.
     */
    await expect(updateSetting('00000000-0000-0000-0000-000000000000', { key: 'Payments:Provider', value: 'asas' })).rejects.toThrow(
      /Valor inv/,
    );
  });

  it('recusa chave que nao esta no catalogo', async () => {
    const { updateSetting } = await import('../src/services/settingsService.js');
    await expect(
      updateSetting('00000000-0000-0000-0000-000000000000', { key: 'Qualquer:Coisa', value: 'x' }),
    ).rejects.toThrow(/inv/);
  });

  it('avisa que o pagamento esta simulado, e em quais servicos', async () => {
    const { getGroups } = await import('../src/services/settingsService.js');
    settings.set('Payments:Provider', 'mock');
    const grupos = await getGroups();
    const pagamento = grupos.find((g) => g.id === 'payments')!;
    expect(pagamento.connected).toBe(false);
    expect(pagamento.warning).toMatch(/SIMULADO/);
    expect(pagamento.warning).toContain('hub');
    expect(pagamento.warning).toContain('OpenDriver');
  });

  it('nao avisa quando os dois servicos tem provedor real', async () => {
    const { getGroups } = await import('../src/services/settingsService.js');
    settings.set('Payments:Provider', 'asaas');
    const grupos = await getGroups();
    const pagamento = grupos.find((g) => g.id === 'payments')!;
    expect(pagamento.connected).toBe(true);
    expect(pagamento.warning).toBeNull();
  });

  it('o hub em mercadopago deixa o OpenDriver simulado, e o aviso diz isso', async () => {
    /**
     * O OpenDriver não implementa Mercado Pago. Sem o override por serviço, um hub em
     * `mercadopago` deixaria as corridas em `mock` com a tela dizendo "mercadopago" — exatamente
     * o tipo de meia-verdade que esta frente existe para eliminar.
     */
    const { getGroups } = await import('../src/services/settingsService.js');
    settings.set('Payments:Provider', 'mercadopago');
    const grupos = await getGroups();
    const pagamento = grupos.find((g) => g.id === 'payments')!;
    expect(pagamento.warning).toContain('OpenDriver');
    expect(pagamento.warning).not.toContain('loja e marketplace');
  });

  it('o override do OpenDriver permite ligar um servico antes do outro', async () => {
    const { getGroups } = await import('../src/services/settingsService.js');
    settings.set('Payments:Provider', 'mock');
    settings.set('OpenDriver:PaymentProvider', 'asaas');
    const grupos = await getGroups();
    const pagamento = grupos.find((g) => g.id === 'payments')!;
    expect(pagamento.warning).toContain('loja e marketplace');
    expect(pagamento.warning).not.toContain('corridas');
  });
});
