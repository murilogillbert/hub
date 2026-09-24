import type {
  DriverAffiliateDto,
  DriverSearchResultDto,
  MyAffiliateProgramDto,
  StoreReferralMetricsDto,
} from '../dtos/driverAffiliate.dto.js';
import { round2 } from '../domain/commissionRules.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateAffiliateCode(): string {
  let out = '';
  for (let i = 0; i < 7; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

/** Programa de afiliação loja↔motorista — independente do programa de
 * afiliados solar (Partner-a-Partner) e da pesquisa de opinião. A loja
 * busca um motorista, define uma comissão % sobre a venda, e o motorista
 * ganha um código global (User.affiliateCode) que qualquer comprador digita
 * no checkout. */

/** Busca por CÓDIGO exato (o mesmo código único do motorista, o que ele
 * também usa no checkout) — nunca por nome/e-mail. A loja só consegue
 * adicionar um motorista que já compartilhou o próprio código com ela; não
 * dá pra "descobrir" motoristas digitando letras soltas (LGPD). */
export async function findDriverByCode(partnerId: string, code: string): Promise<DriverSearchResultDto[]> {
  const query = code.trim();
  if (!query) return [];
  const driver = await prisma.user.findUnique({
    where: { affiliateCode: query },
    select: { id: true, name: true, role: true },
  });
  if (!driver || driver.role !== 'Driver') return [];

  const existing = await prisma.driverAffiliate.findUnique({
    where: { partnerId_driverId: { partnerId, driverId: driver.id } },
  });

  return [{ id: driver.id, name: driver.name, alreadyAffiliated: !!existing }];
}

async function commissionEarnedByDriver(partnerId: string): Promise<Map<string, { amount: number; orders: number }>> {
  const rows = await prisma.driverCommissionEntry.groupBy({
    by: ['driverId'],
    where: { partnerId },
    _sum: { amount: true },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.driverId, { amount: r._sum.amount?.toNumber() ?? 0, orders: r._count._all }]));
}

export async function listForPartner(partnerId: string): Promise<DriverAffiliateDto[]> {
  const rows = await prisma.driverAffiliate.findMany({
    where: { partnerId },
    include: { driver: true },
    orderBy: { createdAt: 'desc' },
  });
  const earnedByDriver = await commissionEarnedByDriver(partnerId);

  return rows.map((r) => {
    const earned = earnedByDriver.get(r.driverId);
    return {
      id: r.id,
      driverId: r.driverId,
      driverName: r.driver.name,
      driverEmail: r.driver.email,
      commissionPercent: r.commissionPercent.toNumber(),
      linkViews: r.linkViews,
      commissionEarned: round2(earned?.amount ?? 0),
      ordersCount: earned?.orders ?? 0,
      createdAt: r.createdAt,
    };
  });
}

async function ensureDriver(driverId: string): Promise<{ id: string; name: string }> {
  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver) throw new AppError('Motorista não encontrado.', 404);
  if (driver.role !== 'Driver') throw new AppError('Este usuário não é um motorista.', 400);
  return driver;
}

export async function add(partnerId: string, driverId: string, commissionPercent: number): Promise<void> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner?.active) throw new AppError('Loja pausada não pode adicionar novos afiliados.', 409);
  await ensureDriver(driverId);
  await prisma.driverAffiliate.upsert({
    where: { partnerId_driverId: { partnerId, driverId } },
    create: { partnerId, driverId, commissionPercent: round2(commissionPercent) },
    update: { commissionPercent: round2(commissionPercent) },
  });
}

export async function updateCommission(partnerId: string, driverId: string, commissionPercent: number): Promise<void> {
  const existing = await prisma.driverAffiliate.findUnique({ where: { partnerId_driverId: { partnerId, driverId } } });
  if (!existing) throw new AppError('Este motorista não é afiliado da sua loja.', 404);
  await prisma.driverAffiliate.update({
    where: { partnerId_driverId: { partnerId, driverId } },
    data: { commissionPercent: round2(commissionPercent) },
  });
}

/** "Definir um valor a todos" — conveniência de UI, aplica o mesmo
 * percentual a todos os afiliados já cadastrados desta loja. Não é um
 * conceito de schema à parte. */
export async function bulkSetCommission(partnerId: string, commissionPercent: number): Promise<void> {
  await prisma.driverAffiliate.updateMany({ where: { partnerId }, data: { commissionPercent: round2(commissionPercent) } });
}

export async function remove(partnerId: string, driverId: string): Promise<void> {
  const existing = await prisma.driverAffiliate.findUnique({ where: { partnerId_driverId: { partnerId, driverId } } });
  if (!existing) throw new AppError('Este motorista não é afiliado da sua loja.', 404);
  // Apaga só o vínculo ativo — o histórico de comissões já pagas fica em
  // DriverCommissionEntry, tabela separada, sem FK pra esta linha.
  await prisma.driverAffiliate.delete({ where: { partnerId_driverId: { partnerId, driverId } } });
}

export async function storeMetrics(partnerId: string): Promise<StoreReferralMetricsDto> {
  // Tudo em agregação no banco — nada de carregar linha por linha em JS
  // (a lista de DriverCommissionEntry cresce sem limite com o tempo).
  // ordersCount = contagem de linhas: a constraint única
  // (orderId, partnerId) em DriverCommissionEntry já garante no máximo 1
  // lançamento por pedido por loja, então count == pedidos distintos.
  const [commissionAgg, linkViewsAgg, revenueAgg] = await Promise.all([
    prisma.driverCommissionEntry.aggregate({ where: { partnerId }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.driverAffiliate.aggregate({ where: { partnerId }, _sum: { linkViews: true } }),
    prisma.orderItem.aggregate({
      where: { partnerId, order: { driverCommissionEntries: { some: { partnerId } } } },
      _sum: { lineTotal: true },
    }),
  ]);

  return {
    ordersCount: commissionAgg._count._all,
    revenue: round2(revenueAgg._sum.lineTotal?.toNumber() ?? 0),
    commissionPaid: round2(commissionAgg._sum.amount?.toNumber() ?? 0),
    linkViews: linkViewsAgg._sum.linkViews ?? 0,
  };
}

export async function myAffiliateProgram(driverId: string): Promise<MyAffiliateProgramDto> {
  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver) throw new AppError('Usuário não encontrado.', 404);

  let code = driver.affiliateCode;
  if (!code) {
    code = generateAffiliateCode();
    while (await prisma.user.findUnique({ where: { affiliateCode: code } })) code = generateAffiliateCode();
    await prisma.user.update({ where: { id: driverId }, data: { affiliateCode: code } });
  }

  const rows = await prisma.driverAffiliate.findMany({
    where: { driverId },
    include: { partner: true },
    orderBy: { createdAt: 'desc' },
  });
  const earned = await prisma.driverCommissionEntry.groupBy({
    by: ['partnerId'],
    where: { driverId },
    _sum: { amount: true },
  });
  const earnedByPartner = new Map(earned.map((e) => [e.partnerId, e._sum.amount?.toNumber() ?? 0]));

  return {
    affiliateCode: code,
    stores: rows.map((r) => ({
      id: r.id,
      partnerId: r.partnerId,
      partnerName: r.partner.name,
      partnerLogoUrl: r.partner.logoUrl,
      commissionPercent: r.commissionPercent.toNumber(),
      linkViews: r.linkViews,
      commissionEarned: round2(earnedByPartner.get(r.partnerId) ?? 0),
    })),
  };
}

/** GET /r/indicacao/:id — não falha se o id não existir, só não conta a
 * visita (mesmo padrão tolerante do redirect da pesquisa de opinião). */
export async function recordClickAndGetPartnerId(driverAffiliateId: string): Promise<string | null> {
  const row = await prisma.driverAffiliate.findUnique({ where: { id: driverAffiliateId } });
  if (!row) return null;
  await prisma.driverAffiliate.update({ where: { id: driverAffiliateId }, data: { linkViews: { increment: 1 } } });
  return row.partnerId;
}

/** Resolve o código de afiliado digitado no checkout: existe o motorista? E
 * ele é afiliado de ALGUMA das lojas do carrinho? Usado na criação do
 * pedido (orderService.createOrder) — lança o erro exato pedido pelo
 * stakeholder quando não bate com nenhuma loja do carrinho. Motorista não
 * pode se autoindicar (usar o próprio código na própria compra). */
export async function resolveCheckoutCode(affiliateCode: string, distinctPartnerIds: string[], buyerId: string): Promise<string> {
  const driver = await prisma.user.findUnique({ where: { affiliateCode: affiliateCode.trim() } });
  if (!driver) throw new AppError('código não faz parte dos nossos afiliados', 400);
  if (driver.id === buyerId) throw new AppError('código não faz parte dos nossos afiliados', 400);

  const match = await prisma.driverAffiliate.findFirst({
    where: { driverId: driver.id, partnerId: { in: distinctPartnerIds } },
  });
  if (!match) throw new AppError('código não faz parte dos nossos afiliados', 400);

  return driver.id;
}

/** Fonte única de verdade sobre "qual motorista/percentual comissiona cada
 * parceiro deste pedido" — usada tanto pelo split real da Asaas
 * (buildSplits) quanto pelo crédito de verdade em paymentService.approve(),
 * pra nunca divergir entre o que é transferido de fato e o que é creditado
 * ao motorista. */
export async function commissionMapForOrder(order: {
  affiliateDriverId: string | null;
  items: { partnerId: string }[];
}): Promise<Map<string, { driverId: string; percent: number }>> {
  const map = new Map<string, { driverId: string; percent: number }>();
  if (!order.affiliateDriverId) return map;

  const distinctPartnerIds = [...new Set(order.items.map((i) => i.partnerId))];
  // Recheca o papel atual — se o motorista foi rebaixado (deixou de ser
  // Driver) depois de indicar, a comissão para de ser gerada dali em diante,
  // mesmo que o vínculo DriverAffiliate continue existindo.
  const rows = await prisma.driverAffiliate.findMany({
    where: { driverId: order.affiliateDriverId, partnerId: { in: distinctPartnerIds }, driver: { role: 'Driver' } },
  });
  for (const row of rows) map.set(row.partnerId, { driverId: row.driverId, percent: row.commissionPercent.toNumber() });
  return map;
}
