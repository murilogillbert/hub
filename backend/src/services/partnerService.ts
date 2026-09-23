import type { NamedValue, SeriesPoint } from '../dtos/common.dto.js';
import type { ProductDto, ProductUpsertRequest, UpdateMyPartnerProfileRequest } from '../dtos/catalog.dto.js';
import type { AffiliatePartnerDto } from '../dtos/affiliate.dto.js';
import type { PartnerMetricsDto } from '../dtos/partner.dto.js';
import type { RedeemResult } from '../dtos/orders.dto.js';
import { driverCommissionFor, partnerNet, platformFeeFor, round2 } from '../domain/commissionRules.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { parseProductKind, toAffiliatePartnerDto, toProductDto } from '../mappings.js';
import * as driverAffiliateService from './driverAffiliateService.js';

/** Autoatendimento: o próprio parceiro (loja ou afiliado) edita seus dados.
 * feePercent/active/asaasWalletId ficam de fora de propósito — exclusivos do
 * Admin (backend/src/services/adminService.ts updatePartner). */
export async function updateMyProfile(partnerId: string, req: UpdateMyPartnerProfileRequest): Promise<AffiliatePartnerDto> {
  const existing = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!existing) throw new AppError('Parceiro não encontrado.', 404);
  const updated = await prisma.partner.update({
    where: { id: partnerId },
    data: {
      ...(req.name != null ? { name: req.name } : {}),
      ...(req.segment != null ? { segment: req.segment } : {}),
      ...(req.logoUrl != null ? { logoUrl: req.logoUrl } : {}),
      ...(req.cnpj != null ? { cnpj: req.cnpj.trim() } : {}),
      ...(req.documentType != null ? { documentType: req.documentType } : {}),
      ...(req.city != null ? { city: req.city.trim() } : {}),
      ...(req.state != null ? { state: req.state.trim() } : {}),
      ...(req.lat != null ? { lat: req.lat } : {}),
      ...(req.lng != null ? { lng: req.lng } : {}),
    },
  });
  return toAffiliatePartnerDto(updated);
}

export async function myProducts(partnerId: string): Promise<ProductDto[]> {
  const rows = await prisma.product.findMany({
    where: { partnerId },
    include: { partner: true },
    orderBy: { title: 'asc' },
  });
  return rows.map((p) => toProductDto(p));
}

export async function createProduct(partnerId: string, req: ProductUpsertRequest): Promise<ProductDto> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AppError('Parceiro não encontrado.', 404);
  const p = await prisma.product.create({
    data: {
      partnerId,
      title: req.title,
      description: req.description,
      price: req.price,
      cashbackPercent: req.cashbackPercent,
      kind: parseProductKind(req.kind),
      imageUrl: req.imageUrl,
      category: req.category,
      stock: req.stock,
      rating: 5.0,
    },
    include: { partner: true },
  });
  return toProductDto(p);
}

export async function updateProduct(partnerId: string, productId: string, req: ProductUpsertRequest): Promise<ProductDto> {
  const existing = await prisma.product.findFirst({ where: { id: productId, partnerId } });
  if (!existing) throw new AppError('Produto não encontrado.', 404);
  const p = await prisma.product.update({
    where: { id: productId },
    data: {
      title: req.title,
      description: req.description,
      price: req.price,
      cashbackPercent: req.cashbackPercent,
      kind: parseProductKind(req.kind),
      imageUrl: req.imageUrl,
      category: req.category,
      stock: req.stock,
    },
    include: { partner: true },
  });
  return toProductDto(p);
}

export async function deleteProduct(partnerId: string, productId: string): Promise<void> {
  const existing = await prisma.product.findFirst({ where: { id: productId, partnerId } });
  if (!existing) throw new AppError('Produto não encontrado.', 404);
  // Soft-delete (preserva histórico de pedidos).
  await prisma.product.update({ where: { id: productId }, data: { active: false } });
}

function methodLabel(m: string | null): string {
  switch (m) {
    case 'Pix':
      return 'Pix';
    case 'CreditCard':
      return 'Crédito';
    case 'DebitCard':
      return 'Débito';
    default:
      return 'Outro';
  }
}

export async function metrics(partnerId: string): Promise<PartnerMetricsDto> {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  const fee = partner?.feePercent.toNumber() ?? 10;

  // Itens deste parceiro (pedido multi-parceiro: agregamos por item).
  const items = await prisma.orderItem.findMany({ where: { partnerId }, include: { order: true } });

  const isValid = (i: (typeof items)[number]) => i.order.status === 'Paid' || i.order.status === 'Redeemed';
  const valid = items.filter(isValid);
  const revenue = valid.reduce((acc, i) => acc + i.lineTotal.toNumber(), 0);

  const netOf = (i: (typeof items)[number]) =>
    partnerNet(i.lineTotal.toNumber(), platformFeeFor(i.lineTotal.toNumber(), fee), i.cashbackEarned.toNumber());

  // Repasse REAL: "Recebido" = soma dos repasses lançados pelo admin.
  // "A receber" = líquido já resgatado ainda não repassado.
  const earnedNet = valid.filter((i) => i.redeemedAt !== null).reduce((acc, i) => acc + netOf(i), 0);
  const paidTransferAgg = await prisma.partnerPayout.aggregate({ where: { partnerId }, _sum: { amount: true } });
  const paidTransfer = paidTransferAgg._sum.amount?.toNumber() ?? 0;
  const pendingTransfer = Math.max(0, earnedNet - paidTransfer);

  // Pedidos (distintos) que contêm itens deste parceiro.
  const ordersById = new Map(items.map((i) => [i.order.id, i.order]));
  const orders = [...ordersById.values()];
  const pendingCount = orders.filter((o) => o.status === 'PendingPayment').length;
  const paidOrders = orders.filter((o) => o.status === 'Paid' || o.status === 'Redeemed');
  // "Resgatado" = pedido em que todos os itens deste parceiro foram resgatados.
  const redeemedCount = paidOrders.filter((o) => items.filter((i) => i.orderId === o.id).every((i) => i.redeemedAt !== null)).length;
  const paidCount = paidOrders.length - redeemedCount;

  const validOrderCount = paidOrders.length;
  const avgTicket = validOrderCount > 0 ? round2(revenue / validOrderCount) : 0;
  const cashbackGranted = valid.reduce((acc, i) => acc + i.cashbackEarned.toNumber(), 0);
  const uniqueCustomers = new Set(valid.map((i) => i.order.customerId)).size;
  const redemptionRate = paidCount + redeemedCount > 0 ? round2((100 * redeemedCount) / (paidCount + redeemedCount)) : 0;

  const byHour: SeriesPoint[] = Array.from({ length: 24 }, (_, h) => ({
    label: `${String(h).padStart(2, '0')}h`,
    value: valid.filter((i) => i.order.createdAt.getHours() === h).length,
  })).filter((s) => s.value > 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const last7: SeriesPoint[] = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - 6 + idx);
    const next = new Date(d);
    next.setUTCDate(next.getUTCDate() + 1);
    const value = valid
      .filter((i) => i.order.createdAt >= d && i.order.createdAt < next)
      .reduce((acc, i) => acc + i.lineTotal.toNumber(), 0);
    return { label: `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`, value };
  });

  const topProducts = groupNamedValue(valid, (i) => (i.productTitle.length === 0 ? '—' : i.productTitle))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const byCategory = groupNamedValue(valid, (i) => (i.category.length === 0 ? '—' : i.category)).sort(
    (a, b) => b.value - a.value,
  );
  const byMethod = groupNamedValueCount(valid, (i) => methodLabel(i.order.paymentMethod)).sort(
    (a, b) => b.value - a.value,
  );
  const driverReferral = await driverAffiliateService.storeMetrics(partnerId);

  return {
    totalRevenue: round2(revenue),
    totalSales: validOrderCount,
    pendingTransfer: round2(pendingTransfer),
    paidTransfer: round2(paidTransfer),
    averageTicket: avgTicket,
    cashbackGranted: round2(cashbackGranted),
    uniqueCustomers,
    pendingCount,
    paidCount,
    redeemedCount,
    redemptionRate,
    salesByHour: byHour,
    revenueLastDays: last7,
    topProducts,
    salesByCategory: byCategory,
    paymentMethods: byMethod,
    driverReferral,
  };
}

function groupNamedValue<T>(items: T[], keyOf: (i: T) => string): NamedValue[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const item of items as any[]) {
    const key = keyOf(item);
    const entry = map.get(key) ?? { value: 0, count: 0 };
    entry.value += item.lineTotal.toNumber();
    entry.count += item.quantity;
    map.set(key, entry);
  }
  return [...map.entries()].map(([name, v]) => ({ name, value: round2(v.value), count: v.count }));
}

function groupNamedValueCount<T>(items: T[], keyOf: (i: T) => string): NamedValue[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const item of items as any[]) {
    const key = keyOf(item);
    const entry = map.get(key) ?? { value: 0, count: 0 };
    entry.value += item.lineTotal.toNumber();
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.entries()].map(([name, v]) => ({ name, value: round2(v.value), count: v.count }));
}

export async function redeem(partnerId: string, actorId: string, code: string, confirm: boolean): Promise<RedeemResult> {
  const normalized = code.replace(/-/g, '').trim().toUpperCase();

  const order = await prisma.order.findFirst({
    where: { code: { equals: normalized, mode: 'insensitive' } },
    include: { customer: true, items: true },
  });
  if (!order) throw new AppError('Código não encontrado.', 404);

  if (order.status === 'PendingPayment') throw new AppError('Voucher não está pago/liberado.', 409);
  if (order.status === 'Cancelled') throw new AppError('Pedido cancelado.', 409);

  // Só os itens DESTA loja (pedido pode ter vários parceiros).
  const myItems = order.items.filter((i) => i.partnerId === partnerId);
  if (myItems.length === 0) throw new AppError('Este voucher não contém itens da sua loja.', 409);
  const pending = myItems.filter((i) => i.redeemedAt === null);
  if (pending.length === 0)
    throw new AppError('Os itens da sua loja neste voucher já foram resgatados.', 409);

  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AppError('Parceiro não encontrado.', 404);
  const fee = partner.feePercent.toNumber();
  const subtotal = pending.reduce((acc, i) => acc + i.lineTotal.toNumber(), 0);
  const cashback = pending.reduce((acc, i) => acc + i.cashbackEarned.toNumber(), 0);
  const platformFee = platformFeeFor(subtotal, fee);
  // A comissão já foi de fato creditada ao motorista em
  // paymentService.approve() (não aqui) — isso só recalcula o mesmo valor
  // pra exibir o líquido certo pro parceiro nesta tela/no audit log.
  const commissionByPartner = await driverAffiliateService.commissionMapForOrder(order);
  const commissionInfo = commissionByPartner.get(partnerId);
  const commission = commissionInfo ? driverCommissionFor(subtotal, commissionInfo.percent) : 0;
  const net = partnerNet(subtotal, platformFee, cashback, commission);
  const title = pending.map((i) => `${i.quantity}x ${i.productTitle}`).join(', ');

  if (!confirm)
    return {
      orderId: order.id,
      productTitle: title,
      customerName: order.customer.name,
      paidPrice: round2(subtotal),
      feePercent: fee,
      platformFee: round2(platformFee),
      customerCashback: round2(cashback),
      partnerNet: round2(net),
      redeemed: false,
    };

  await prisma.$transaction(async (tx) => {
    const fresh = await tx.order.findUnique({ where: { id: order.id }, include: { items: true } });
    if (!fresh) throw new AppError('Pedido não encontrado.', 404);

    const freshPending = fresh.items.filter((i) => i.partnerId === partnerId && i.redeemedAt === null);
    if (freshPending.length === 0)
      throw new AppError('Os itens da sua loja neste voucher já foram resgatados.', 409);

    const now = new Date();
    const redeemedIds = new Set(fresh.items.filter((i) => i.redeemedAt !== null).map((i) => i.id));
    for (const item of freshPending) {
      await tx.orderItem.update({ where: { id: item.id }, data: { redeemedAt: now } });
      await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      redeemedIds.add(item.id);
    }

    // Pedido só fica "Resgatado" quando TODOS os itens forem resgatados.
    const allRedeemed = redeemedIds.size === fresh.items.length;
    if (allRedeemed) {
      await tx.order.update({ where: { id: fresh.id }, data: { status: 'Redeemed', redeemedAt: now } });
    }

    await tx.notification.create({
      data: {
        userId: fresh.customerId,
        title: 'Voucher resgatado',
        message: `Itens de ${partner.name} no pedido ${fresh.code} resgatados.`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'order.redeem',
        entityType: 'Order',
        entityId: fresh.id,
        payloadJson: JSON.stringify({ code: fresh.code, partnerId, net, cashback, subtotal, commission }),
      },
    });
  });

  return {
    orderId: order.id,
    productTitle: title,
    customerName: order.customer.name,
    paidPrice: round2(subtotal),
    feePercent: fee,
    platformFee: round2(platformFee),
    customerCashback: round2(cashback),
    partnerNet: round2(net),
    redeemed: true,
  };
}
