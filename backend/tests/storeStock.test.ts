import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { toStoreDto } from '../src/mappings.js';
import * as catalogService from '../src/services/catalogService.js';
import * as estoqueService from '../src/services/productStoreStockService.js';
import * as partnerService from '../src/services/partnerService.js';

/**
 * Importação **estática** dos serviços, e nenhum `vi.resetModules()`.
 *
 * `resetModules` recria o grafo de módulos, inclusive `infra/prisma.ts` — e aí o falso injetado
 * por `__setPrismaForTests` fica no módulo antigo enquanto o serviço novo usa o cliente real.
 * O sintoma é um erro de autenticação no Postgres no meio de um teste de unidade.
 */

/**
 * Estoque por unidade e horário de funcionamento, do lado do serviço.
 *
 * Prisma falso: sem Docker. O que precisa de prova aqui é, em ordem de risco:
 *
 *   1. Produto **sem** linha de estoque por unidade continua disponível em todas as unidades.
 *      É a propriedade que impede o deploy desta frente de sumir com o catálogo inteiro.
 *   2. A unidade informada pertence ao parceiro. Sem isso, um lojista mexe no estoque do outro.
 *   3. A baixa no resgate nunca falha — o cliente está no balcão com voucher pago.
 */

const PARCEIRO = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OUTRO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRODUTO = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DIGITAL = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const LOJA_A = '11111111-1111-4111-8111-111111111111';
const LOJA_B = '22222222-2222-4222-8222-222222222222';
const LOJA_ALHEIA = '33333333-3333-4333-8333-333333333333';

type LinhaDeEstoque = {
  productId: string;
  storeId: string;
  quantity: number;
  active: boolean;
  updatedAt?: Date;
};

interface Mundo {
  produtos: {
    id: string;
    partnerId: string;
    kind: 'Voucher' | 'Digital';
    title: string;
    description: string;
    price: { toNumber: () => number };
    cashbackPercent: { toNumber: () => number };
    imageUrl: string;
    category: string;
    rating: number;
    stock: number;
  }[];
  unidades: {
    id: string;
    partnerId: string;
    name: string;
    city: string;
    state: string;
    active: boolean;
    timezone: string;
    openingHours: unknown;
  }[];
  estoque: LinhaDeEstoque[];
}

function unidade(over: Partial<Mundo['unidades'][number]> = {}): Mundo['unidades'][number] {
  return {
    id: LOJA_A,
    partnerId: PARCEIRO,
    name: 'Centro',
    city: 'Campo Grande',
    state: 'MS',
    active: true,
    timezone: 'America/Campo_Grande',
    openingHours: null,
    ...over,
  };
}

/** Linhas gravadas/alteradas, para conferir o efeito das mutações. */
let upserts: { where: unknown; create: unknown; update: unknown }[] = [];
let updateManys: { where: Record<string, unknown>; data: Record<string, unknown> }[] = [];
let orderItemUpdates: { where: unknown; data: Record<string, unknown> }[] = [];

function montar(mundo: Mundo) {
  upserts = [];
  updateManys = [];
  orderItemUpdates = [];

  const casa = (l: LinhaDeEstoque, w: Record<string, unknown>): boolean => {
    if (w.productId && l.productId !== w.productId) return false;
    if (w.storeId && l.storeId !== w.storeId) return false;
    const q = w.quantity as { gte?: number; gt?: number } | undefined;
    if (q?.gte !== undefined && !(l.quantity >= q.gte)) return false;
    if (q?.gt !== undefined && !(l.quantity > q.gt)) return false;
    return true;
  };

  const estoqueDelegate = {
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
      const ids = (where?.productId as { in?: string[] } | undefined)?.in;
      return mundo.estoque
        .filter((l) => (ids ? ids.includes(l.productId) : true))
        .filter((l) => (where?.productId && !ids ? l.productId === where.productId : true))
        .map((l) => ({ ...l, updatedAt: l.updatedAt ?? new Date('2026-10-09T12:00:00.000Z') }));
    }),
    upsert: vi.fn(async (args: { where: unknown; create: unknown; update: unknown }) => {
      upserts.push(args);
      return {};
    }),
    updateMany: vi.fn(
      async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updateManys.push({ where, data });
        const atingidas = mundo.estoque.filter((l) => casa(l, where));
        for (const l of atingidas) {
          const dec = (data.quantity as { decrement?: number } | number | undefined);
          if (typeof dec === 'object' && dec?.decrement !== undefined) {
            l.quantity -= dec.decrement;
          } else if (typeof dec === 'number') {
            l.quantity = dec;
          }
        }
        return { count: atingidas.length };
      }
    ),
  };

  const productDelegate = {
    findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const p = mundo.produtos.find(
        (x) => x.id === where.id && (!where.partnerId || x.partnerId === where.partnerId)
      );
      return p ?? null;
    }),
    findMany: vi.fn(async () => mundo.produtos.map((p) => ({ ...p, partner: { name: 'Loja' } }))),
    updateMany: vi.fn(async () => ({ count: 1 })),
  };

  const partnerStoreDelegate = {
    findMany: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
      const ids = (where?.id as { in?: string[] } | undefined)?.in;
      return mundo.unidades
        .filter((u) => (where?.partnerId ? u.partnerId === where.partnerId : true))
        .filter((u) => (ids ? ids.includes(u.id) : true))
        .filter((u) => (where?.active === true ? u.active : true));
    }),
    findFirst: vi.fn(
      async ({ where }: { where: Record<string, unknown> }) =>
        mundo.unidades.find(
          (u) => u.id === where.id && (!where.partnerId || u.partnerId === where.partnerId)
        ) ?? null
    ),
  };

  const orderItemDelegate = {
    update: vi.fn(async (args: { where: unknown; data: Record<string, unknown> }) => {
      orderItemUpdates.push(args);
      return {};
    }),
  };

  const prisma = {
    product: productDelegate,
    partnerStore: partnerStoreDelegate,
    productStoreStock: estoqueDelegate,
    orderItem: orderItemDelegate,
    // `$transaction` com callback repassa o mesmo conjunto de delegates: o falso não simula
    // isolamento, e não precisa — o que está em prova é a sequência de escritas.
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        product: productDelegate,
        partnerStore: partnerStoreDelegate,
        productStoreStock: estoqueDelegate,
        orderItem: orderItemDelegate,
      })
    ),
  };

  __setPrismaForTests(prisma as unknown as PrismaClient);
  return { prisma, mundo };
}

/** `Decimal` do Prisma, só com o que o mapeador usa. */
const dec = (n: number) => ({ toNumber: () => n }) as unknown as Mundo['produtos'][number]['price'];

function produto(over: Partial<Mundo['produtos'][number]> = {}): Mundo['produtos'][number] {
  return {
    id: PRODUTO,
    partnerId: PARCEIRO,
    kind: 'Voucher',
    title: 'Combo',
    description: 'Combo de teste',
    price: dec(18.9),
    cashbackPercent: dec(5),
    imageUrl: '',
    category: 'Alimentação',
    rating: 4.5,
    stock: 10,
    ...over,
  };
}

const produtoFisico = produto();
const produtoDigital = produto({
  id: DIGITAL,
  kind: 'Digital',
  title: 'Cartao presente',
  stock: 999,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('productStoreStockService.listar', () => {
  it('devolve uma linha por unidade do parceiro, inclusive as sem registro', async () => {
    /**
     * Unidade sem registro precisa aparecer com zero. Devolver só as existentes faria a unidade
     * nova desaparecer do formulário exatamente quando o lojista precisa cadastrá-la.
     */
    montar({
      produtos: [produtoFisico],
      unidades: [unidade(), unidade({ id: LOJA_B, name: 'Shopping' })],
      estoque: [{ productId: PRODUTO, storeId: LOJA_A, quantity: 4, active: true }],
    });
    const r = await estoqueService.listar(PARCEIRO, PRODUTO);

    expect(r.declared).toBe(true);
    expect(r.items).toHaveLength(2);
    expect(r.items.find((i) => i.storeId === LOJA_A)).toMatchObject({ quantity: 4, active: true });
    const semRegistro = r.items.find((i) => i.storeId === LOJA_B)!;
    expect(semRegistro).toMatchObject({ quantity: 0, active: true });
    // Data inventada faria a tela dizer "atualizado em 01/01/1970" para linha que não existe.
    expect(semRegistro.updatedAt).toBeNull();
  });

  it('declared é false quando nada foi preenchido', async () => {
    montar({ produtos: [produtoFisico], unidades: [unidade()], estoque: [] });
    const r = await estoqueService.listar(PARCEIRO, PRODUTO);
    /**
     * É o que separa "disponível em todas" de "esgotado em todas". Sem a distinção, a tela
     * diria ao lojista que o produto está esgotado quando ele apenas nunca preencheu.
     */
    expect(r.declared).toBe(false);
  });

  it('produto de outra loja responde 404, nao 403', async () => {
    // 403 confirmaria que o identificador existe.
    montar({ produtos: [produtoFisico], unidades: [unidade()], estoque: [] });
    await expect(estoqueService.listar(OUTRO, PRODUTO)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('productStoreStockService.definir', () => {
  it('grava em lote, numa transacao', async () => {
    const { prisma } = montar({
      produtos: [produtoFisico],
      unidades: [unidade(), unidade({ id: LOJA_B, name: 'Shopping' })],
      estoque: [],
    });
    await estoqueService.definir(PARCEIRO, PRODUTO, {
      items: [
        { storeId: LOJA_A, quantity: 5, active: true },
        { storeId: LOJA_B, quantity: 0, active: false },
      ],
    });
    // Em lote e numa transação: a tela mostra todas as unidades juntas, e uma chamada por linha
    // deixaria estado meio salvo se a terceira falhasse.
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(upserts).toHaveLength(2);
  });

  it('recusa unidade de outro parceiro', async () => {
    /**
     * O `storeId` vem do corpo e a FK aceitaria qualquer unidade existente. Sem esta
     * conferência, o produto apareceria no filtro por unidade da loja alheia.
     */
    montar({
      produtos: [produtoFisico],
      unidades: [unidade(), unidade({ id: LOJA_ALHEIA, partnerId: OUTRO, name: 'Rival' })],
      estoque: [],
    });
    await expect(
      estoqueService.definir(PARCEIRO, PRODUTO, {
        items: [{ storeId: LOJA_ALHEIA, quantity: 99, active: true }],
      })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(upserts).toHaveLength(0);
  });

  it('recusa a mesma unidade duas vezes no mesmo pedido', async () => {
    montar({ produtos: [produtoFisico], unidades: [unidade()], estoque: [] });
    await expect(
      estoqueService.definir(PARCEIRO, PRODUTO, {
        items: [
          { storeId: LOJA_A, quantity: 1, active: true },
          { storeId: LOJA_A, quantity: 2, active: true },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('productStoreStockService.baixarNaUnidade', () => {
  it('decrementa quando ha contagem suficiente', async () => {
    const { prisma, mundo } = montar({
      produtos: [produtoFisico],
      unidades: [unidade()],
      estoque: [{ productId: PRODUTO, storeId: LOJA_A, quantity: 5, active: true }],
    });
    const r = await estoqueService.baixarNaUnidade(prisma as never, PRODUTO, LOJA_A, 2);
    expect(r.baixou).toBe(true);
    expect(mundo.estoque[0]!.quantity).toBe(3);
  });

  it('contagem defasada e zerada, e nao lanca', async () => {
    /**
     * O cliente está no balcão com um voucher **pago**. Recusar a entrega porque uma contagem
     * auxiliar está desatualizada seria o pior resultado possível; deixar negativo seria um
     * número que a tela não sabe mostrar.
     */
    const { prisma, mundo } = montar({
      produtos: [produtoFisico],
      unidades: [unidade()],
      estoque: [{ productId: PRODUTO, storeId: LOJA_A, quantity: 1, active: true }],
    });
    const r = await estoqueService.baixarNaUnidade(prisma as never, PRODUTO, LOJA_A, 3);
    expect(r.baixou).toBe(false);
    expect(mundo.estoque[0]!.quantity).toBe(0);
  });

  it('unidade sem linha nao lanca', async () => {
    const { prisma } = montar({ produtos: [produtoFisico], unidades: [unidade()], estoque: [] });
    await expect(estoqueService.baixarNaUnidade(prisma as never, PRODUTO, LOJA_A, 1)).resolves.toEqual({
      baixou: false,
    });
  });

  it('quantidade zero nao toca no banco', async () => {
    const { prisma } = montar({ produtos: [produtoFisico], unidades: [unidade()], estoque: [] });
    await estoqueService.baixarNaUnidade(prisma as never, PRODUTO, LOJA_A, 0);
    expect(updateManys).toHaveLength(0);
  });
});

describe('catalogo com estoque por unidade', () => {
  it('produto SEM linha continua disponivel em todas as unidades', async () => {
    /**
     * A propriedade mais importante desta frente. O acervo inteiro está sem linhas, e tratar
     * ausência como "indisponível" sumiria com o catálogo no instante do deploy.
     */
    montar({
      produtos: [produtoFisico],
      unidades: [unidade(), unidade({ id: LOJA_B, name: 'Shopping' })],
      estoque: [],
    });
    const itens = await catalogService.getProducts();
    expect(itens).toHaveLength(1);
    expect(itens[0]!.storeStockDeclared).toBe(false);
    // Filtrar por qualquer das duas unidades devolve o produto.
    for (const loja of [LOJA_A, LOJA_B]) {
      const r = await catalogService.searchCatalog({ page: 1, pageSize: 20, storeId: loja });
      expect(r.items.map((i) => i.id)).toContain(PRODUTO);
    }
  });

  it('produto declarado so aparece na unidade que tem', async () => {
    montar({
      produtos: [produtoFisico],
      unidades: [unidade(), unidade({ id: LOJA_B, name: 'Shopping' })],
      estoque: [
        { productId: PRODUTO, storeId: LOJA_A, quantity: 3, active: true },
        { productId: PRODUTO, storeId: LOJA_B, quantity: 0, active: true },
      ],
    });
    const naA = await catalogService.searchCatalog({ page: 1, pageSize: 20, storeId: LOJA_A });
    expect(naA.items.map((i) => i.id)).toContain(PRODUTO);
    // "Acabou na loja do shopping" — que é o caso que esta frente existe para representar.
    const naB = await catalogService.searchCatalog({ page: 1, pageSize: 20, storeId: LOJA_B });
    expect(naB.items.map((i) => i.id)).not.toContain(PRODUTO);
  });

  it('linha desativada conta como indisponivel sem perder a contagem', async () => {
    montar({
      produtos: [produtoFisico],
      unidades: [unidade()],
      estoque: [{ productId: PRODUTO, storeId: LOJA_A, quantity: 7, active: false }],
    });
    const r = await catalogService.searchCatalog({ page: 1, pageSize: 20, storeId: LOJA_A });
    expect(r.items).toHaveLength(0);
    // "Não vendo este item aqui" é informação diferente de "acabou", e a contagem fica.
    const todos = await catalogService.getProducts();
    expect(todos[0]!.availableStores).toEqual([]);
    expect(todos[0]!.storeStockDeclared).toBe(true);
  });

  it('produto digital nao e filtrado por unidade', async () => {
    /**
     * Não se retira cartão-presente em loja nenhuma. Filtrá-lo daria "nada disponível" numa
     * loja que vende exatamente isso.
     */
    montar({
      produtos: [produtoDigital],
      unidades: [unidade()],
      estoque: [],
    });
    const r = await catalogService.searchCatalog({ page: 1, pageSize: 20, storeId: LOJA_ALHEIA });
    expect(r.items.map((i) => i.id)).toContain(DIGITAL);
  });

  it('aberto agora filtra por horario da unidade', async () => {
    const comercio = { seg: [{ de: '09:00', ate: '18:00' }], sex: [{ de: '09:00', ate: '18:00' }] };
    montar({
      produtos: [produtoFisico],
      unidades: [unidade({ openingHours: comercio })],
      estoque: [],
    });

    // 2026-10-09 é sexta. 15:00 UTC = 11:00 em Campo Grande (UTC-4): aberta.
    vi.setSystemTime(new Date('2026-10-09T15:00:00.000Z'));
    const aberto = await catalogService.searchCatalog({ page: 1, pageSize: 20, openNow: true });
    expect(aberto.items.map((i) => i.id)).toContain(PRODUTO);

    // 03:00 UTC = 23:00 de quinta em Campo Grande: fechada.
    vi.setSystemTime(new Date('2026-10-09T03:00:00.000Z'));
    const fechado = await catalogService.searchCatalog({ page: 1, pageSize: 20, openNow: true });
    expect(fechado.items.map((i) => i.id)).not.toContain(PRODUTO);

    vi.useRealTimers();
  });

  it('sem os filtros novos, o catalogo nao consulta unidades a mais', async () => {
    /**
     * Este é o caminho mais quente do hub. A consulta de unidades abertas só deve acontecer
     * quando algum dos filtros novos é pedido — do contrário toda busca pagaria por um dado
     * que ninguém olhou.
     */
    const { prisma } = montar({ produtos: [produtoFisico], unidades: [unidade()], estoque: [] });
    await catalogService.searchCatalog({ page: 1, pageSize: 20 });
    // Só a consulta de localização (`storeMap`), não a de unidades abertas.
    expect(prisma.partnerStore.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('toStoreDto', () => {
  const sexta18h = new Date('2026-10-09T21:00:00.000Z'); // 18:00 em SP, 17:00 em Campo Grande

  it('unidade desativada nunca esta aberta', async () => {
    /**
     * A ordem importa: checar o horário primeiro e o `active` depois daria "aberta" para uma
     * loja em reforma.
     */
    const dto = toStoreDto(
      unidade({
        active: false,
        timezone: 'America/Campo_Grande',
        openingHours: { sex: [{ de: '09:00', ate: '18:00' }] },
      }) as never,
      sexta18h
    );
    expect(dto.openNow).toBe(false);
  });

  it('horario invalido no banco nao derruba a leitura', async () => {
    // Linha editada à mão ou gravada antes da validação. Na dúvida, não declarado = aberta.
    const dto = toStoreDto(unidade({ openingHours: { seg: 'nove as seis' } }) as never, sexta18h);
    expect(dto.openingHours).toBeNull();
    expect(dto.openNow).toBe(true);
  });

  it('sem horario declarado, aberta e sem previsao', async () => {
    const dto = toStoreDto(unidade({ openingHours: null }) as never, sexta18h);
    expect(dto.openNow).toBe(true);
    expect(dto.nextOpening).toBeNull();
  });

  it('fechada traz a proxima abertura', async () => {
    const dto = toStoreDto(
      unidade({
        timezone: 'America/Sao_Paulo',
        openingHours: { seg: [{ de: '09:00', ate: '18:00' }] },
      }) as never,
      sexta18h
    );
    expect(dto.openNow).toBe(false);
    expect(dto.nextOpening).toEqual({ dia: 'seg', hora: '09:00' });
  });
});

describe('Prisma.DbNull', () => {
  it('existe e e diferente de null', () => {
    /**
     * Em coluna `Json?` o Prisma distingue `JsonNull` (o valor JSON `null` dentro da coluna) de
     * `DbNull` (NULL de SQL). "Horário não declarado" se consulta por `IS NULL`, então o
     * segundo é o certo — e passar `null` cru nem compila.
     */
    expect(Prisma.DbNull).toBeDefined();
    expect(Prisma.DbNull).not.toBeNull();
  });
});

/**
 * A lista de produtos **do próprio lojista** precisa saber onde cada produto está declarado.
 *
 * Nenhum teste cobria isto, e o defeito só apareceu com o aplicativo na mão: um produto
 * declarado em **uma** unidade aparecia com a etiqueta "todas as unidades". A causa era
 * `myProducts` chamar `toProductDto(p)` sem a disponibilidade, o que faz
 * `storeStockDeclared` sair `false` — e `false` significa, por desenho, "não declarado, logo
 * disponível em todas".
 *
 * O caso de um produto só já falharia. Os três abaixo existem porque cada um corresponde a
 * uma etiqueta diferente na tela, e a antiga implementação mostrava **a mesma** para os três.
 */
describe('produtos do lojista: disponibilidade por unidade na listagem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('distingue declarado em uma unidade, nas duas, e não declarado', async () => {
    const soNaLojaA = produto({ id: PRODUTO, title: 'So na A' });
    const nasDuas = produto({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Nas duas' });
    const semDeclaracao = produto({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      title: 'Sem declaracao',
    });

    montar({
      produtos: [soNaLojaA, nasDuas, semDeclaracao],
      unidades: [unidade({ id: LOJA_A }), unidade({ id: LOJA_B, name: 'Bairro' })],
      estoque: [
        { productId: soNaLojaA.id, storeId: LOJA_A, quantity: 5, active: true },
        { productId: nasDuas.id, storeId: LOJA_A, quantity: 5, active: true },
        { productId: nasDuas.id, storeId: LOJA_B, quantity: 2, active: true },
      ],
    });

    const lista = await partnerService.myProducts(PARCEIRO);
    const por = new Map(lista.map((p) => [p.title, p]));

    // Declarado em uma: a tela mostra "1 unidade(s)". Antes mostrava "todas as unidades".
    expect(por.get('So na A')?.storeStockDeclared).toBe(true);
    expect(por.get('So na A')?.availableStores).toEqual([LOJA_A]);

    expect(por.get('Nas duas')?.storeStockDeclared).toBe(true);
    expect(por.get('Nas duas')?.availableStores).toHaveLength(2);

    // Sem nenhuma linha: `false`, que é o que significa "em todas as unidades". Este caso
    // passava antes — e é justamente por isso que o defeito não aparecia em um teste que só
    // olhasse produto sem declaração.
    expect(por.get('Sem declaracao')?.storeStockDeclared).toBe(false);
    expect(por.get('Sem declaracao')?.availableStores).toEqual([]);
  });

  it('declarado e esgotado em todas vem como declarado com lista vazia', async () => {
    // É o caso que a tela desenha com tom de aviso. Com `declared` sempre falso, o aviso
    // nunca aparecia: produto que acabou em todas as lojas ficava com aparência normal na
    // tela de quem precisa repor.
    const esgotado = produto({ id: PRODUTO, title: 'Esgotado' });
    montar({
      produtos: [esgotado],
      unidades: [unidade({ id: LOJA_A }), unidade({ id: LOJA_B, name: 'Bairro' })],
      estoque: [
        { productId: esgotado.id, storeId: LOJA_A, quantity: 0, active: true },
        { productId: esgotado.id, storeId: LOJA_B, quantity: 7, active: false },
      ],
    });

    const [p] = await partnerService.myProducts(PARCEIRO);
    expect(p.storeStockDeclared).toBe(true);
    expect(p.availableStores).toEqual([]);
  });

  it('usa uma consulta para a lista inteira, nao uma por produto', async () => {
    // A listagem do catálogo é o caminho mais quente do hub, e a regra agora é compartilhada:
    // se alguém trocar por uma consulta por produto, a degradação aparece primeiro aqui.
    const a = produto({ id: PRODUTO, title: 'A' });
    const b = produto({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'B' });
    const c = produto({ id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', title: 'C' });
    const { prisma } = montar({
      produtos: [a, b, c],
      unidades: [unidade({ id: LOJA_A })],
      estoque: [{ productId: a.id, storeId: LOJA_A, quantity: 1, active: true }],
    });

    await partnerService.myProducts(PARCEIRO);
    expect(prisma.productStoreStock.findMany).toHaveBeenCalledTimes(1);
  });
});
