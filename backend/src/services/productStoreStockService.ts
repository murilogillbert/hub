import type { ProductStoreStockDto, ProductStoreStockRequest } from '../dtos/catalog.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';

/**
 * Disponibilidade de um produto nas unidades do parceiro.
 *
 * ============================================================================
 * O que esta tabela NÃO é
 * ============================================================================
 *
 * Não é o estoque que autoriza a compra. Esse continua sendo `products.stock`, que
 * `orderService.createOrder` valida e `partnerService.redeem` decrementa — único, inalterado, e
 * lido por três aplicativos publicados.
 *
 * Aqui a pergunta é outra: **onde dá para retirar**. Antes ela não tinha resposta nenhuma, e
 * uma rede com três lojas não conseguia dizer que o produto acabou em uma só.
 *
 * Tornar o total derivado da soma daqui criaria duas fontes de verdade num caminho que mexe com
 * dinheiro. A nota longa da migration `20261009120000_estoque_por_unidade_e_horario` detalha.
 */

/**
 * Lista a disponibilidade por unidade.
 *
 * Devolve **uma linha por unidade do parceiro**, inclusive as que não têm registro — com
 * `quantity: 0` e `active: true`. A tela precisa mostrar todas as unidades para o lojista poder
 * preencher as que faltam; devolver só as existentes faria a unidade nova desaparecer do
 * formulário exatamente quando ele precisa cadastrá-la.
 */
export async function listar(
  partnerId: string,
  productId: string,
): Promise<{ declared: boolean; items: ProductStoreStockDto[] }> {
  await produtoDoParceiro(partnerId, productId);

  const [unidades, linhas] = await Promise.all([
    prisma.partnerStore.findMany({ where: { partnerId }, orderBy: { name: 'asc' } }),
    prisma.productStoreStock.findMany({ where: { productId } }),
  ]);

  const porUnidade = new Map(linhas.map((l) => [l.storeId, l]));

  return {
    /**
     * `declared` é o que separa "disponível em todas" de "esgotado em todas", e a tela precisa
     * dessa diferença para não dizer ao lojista que o produto está esgotado quando ele apenas
     * nunca preencheu o formulário.
     */
    declared: linhas.length > 0,
    items: unidades.map((u) => {
      const l = porUnidade.get(u.id);
      return {
        storeId: u.id,
        storeName: u.name,
        city: u.city,
        state: u.state,
        quantity: l?.quantity ?? 0,
        active: l?.active ?? true,
        // `null` quando a unidade nunca foi preenchida. Data inventada aqui faria a tela
        // mostrar "atualizado em 01/01/1970" para uma linha que não existe.
        updatedAt: l?.updatedAt ?? null,
      };
    }),
  };
}

/**
 * Grava a disponibilidade em lote.
 *
 * Em lote, e não uma chamada por unidade, porque a tela mostra todas as unidades juntas e o
 * gesto do lojista é "ajustar e salvar". Uma chamada por linha deixaria estado meio salvo se a
 * terceira falhasse — e o lojista não teria como saber quais passaram.
 *
 * Numa transação só, pelo mesmo motivo.
 */
export async function definir(
  partnerId: string,
  productId: string,
  req: ProductStoreStockRequest,
): Promise<{ declared: boolean; items: ProductStoreStockDto[] }> {
  await produtoDoParceiro(partnerId, productId);

  const pedidos = req.items;
  const ids = pedidos.map((i) => i.storeId);
  if (new Set(ids).size !== ids.length) {
    throw new AppError('A mesma unidade aparece duas vezes no pedido.', 400);
  }

  /**
   * As unidades têm de ser **do parceiro**.
   *
   * Sem esta conferência, um lojista poderia gravar estoque do produto dele na unidade de
   * outro parceiro — o `storeId` vem do corpo, e a FK aceitaria qualquer unidade existente. O
   * efeito visível seria o produto aparecendo no filtro por unidade da loja alheia.
   */
  const minhas = await prisma.partnerStore.findMany({
    where: { partnerId, id: { in: ids } },
    select: { id: true },
  });
  if (minhas.length !== ids.length) {
    throw new AppError('Alguma das unidades informadas não é desta loja.', 403);
  }

  await prisma.$transaction(async (tx) => {
    for (const i of pedidos) {
      await tx.productStoreStock.upsert({
        where: { productId_storeId: { productId, storeId: i.storeId } },
        create: {
          productId,
          storeId: i.storeId,
          quantity: i.quantity,
          active: i.active,
        },
        update: { quantity: i.quantity, active: i.active, updatedAt: new Date() },
      });
    }
  });

  return listar(partnerId, productId);
}

/**
 * Baixa de uma unidade no resgate. **Nunca lança.**
 *
 * Chamada de dentro da transação do resgate, e o resgate não pode falhar por causa deste
 * número: o cliente está no balcão com um voucher **pago**. Se a contagem da unidade estiver
 * desatualizada, o certo é atender e deixar a contagem no chão (zero), não recusar a entrega.
 *
 * `updateMany` com `quantity: { gte: n }` é o mesmo padrão já usado no decremento de
 * `products.stock`: o banco decide, sem leitura prévia, e não há corrida entre dois balcões.
 */
export async function baixarNaUnidade(
  tx: Pick<typeof prisma, 'productStoreStock'>,
  productId: string,
  storeId: string,
  quantidade: number,
): Promise<{ baixou: boolean }> {
  if (quantidade <= 0) return { baixou: false };
  const r = await tx.productStoreStock.updateMany({
    where: { productId, storeId, quantity: { gte: quantidade } },
    data: { quantity: { decrement: quantidade }, updatedAt: new Date() },
  });
  if (r.count > 0) return { baixou: true };

  /**
   * Não deu para baixar o valor inteiro: ou não existe linha para esta unidade, ou a contagem
   * é menor que o resgatado. Zera o que houver e segue — deixar negativo seria um número que
   * a tela não sabe mostrar, e recusar bloquearia uma entrega já paga.
   */
  await tx.productStoreStock.updateMany({
    where: { productId, storeId, quantity: { gt: 0 } },
    data: { quantity: 0, updatedAt: new Date() },
  });
  return { baixou: false };
}

async function produtoDoParceiro(partnerId: string, productId: string): Promise<void> {
  const p = await prisma.product.findFirst({
    where: { id: productId, partnerId },
    select: { id: true },
  });
  // 404 e não 403: para quem não é dono, o produto de outra loja não existe. Responder 403
  // confirmaria que o identificador é válido.
  if (!p) throw new AppError('Produto não encontrado.', 404);
}

/**
 * Disponibilidade por unidade dos produtos informados, em **uma** consulta.
 *
 * Uma consulta e não uma por produto: este é o caminho mais quente do hub, e um `include` no
 * modelo deixaria toda leitura de produto mais caro — inclusive as que não usam o dado.
 *
 * O resultado distingue dois casos que parecem iguais de fora:
 *
 *   sem nenhuma linha               →  `declared: false`. Disponível em todas as unidades do
 *                                      parceiro. É o comportamento de hoje, e o acervo inteiro
 *                                      está assim.
 *   com linhas, nenhuma disponível  →  `declared: true`, `stores: []`. Esgotado em todas.
 *
 * Sem essa distinção, o deploy desta frente sumiria com o catálogo inteiro: todo produto
 * passaria a "não disponível em unidade nenhuma".
 *
 * ============================================================================
 * Por que mora aqui, e não no `catalogService`
 * ============================================================================
 *
 * Era privada do `catalogService`, e por isso a lista de produtos **do próprio lojista** não
 * tinha como usá-la: `partnerService.myProducts` chamava `toProductDto(p)` sem o terceiro
 * argumento, então `storeStockDeclared` saía `false` para todo produto.
 *
 * O efeito na tela, visto no tablete em 2026-10-08: um produto declarado em **uma** unidade
 * aparecia com a etiqueta "todas as unidades". Ou seja, a tela de gestão dizia ao lojista o
 * oposto do que ele acabara de configurar — e o aviso de "declarado e esgotado em todas",
 * que depende de `declared === true`, nunca disparava.
 *
 * A tela estava correta; faltava o dado. Mover para cá é o que permite as duas leituras
 * usarem a **mesma** regra: duplicar a consulta criaria duas definições de "onde dá para
 * retirar", e a divergência apareceria como o catálogo e o painel discordando.
 */
export async function disponibilidadePorProduto(
  productIds: string[]
): Promise<Map<string, { stores: string[]; declared: boolean }>> {
  const map = new Map<string, { stores: string[]; declared: boolean }>();
  if (productIds.length === 0) return map;

  const linhas = await prisma.productStoreStock.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, storeId: true, active: true, quantity: true },
  });

  for (const l of linhas) {
    const entry = map.get(l.productId) ?? { stores: [], declared: true };
    entry.declared = true;
    // Linha desativada ou zerada conta como declarada e indisponível — é exatamente o que o
    // lojista quis dizer com "acabou aqui".
    if (l.active && l.quantity > 0) entry.stores.push(l.storeId);
    map.set(l.productId, entry);
  }
  return map;
}
