import type { CashbackEntryDto, CreateOrderRequest, OrderDto } from '../dtos/orders.dto.js';
import { cashbackFor } from '../domain/commissionRules.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { toCashbackEntryDto, toOrderDto, tryParseOrderStatus } from '../mappings.js';
import * as driverAffiliateService from './driverAffiliateService.js';

const orderInclude = { customer: true, items: { include: { partner: true } } } as const;

export function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 16; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createOrder(customerId: string, req: CreateOrderRequest): Promise<OrderDto> {
  // Compat: aceita 1 produto OU uma lista de itens (carrinho). Junta linhas
  // repetidas do mesmo produto.
  const raw = req.items && req.items.length > 0 ? req.items : req.productId ? [{ productId: req.productId, quantity: 1 }] : [];
  const merged = new Map<string, number>();
  for (const it of raw) merged.set(it.productId, (merged.get(it.productId) ?? 0) + Math.max(1, it.quantity));
  if (merged.size === 0) throw new AppError('Carrinho vazio.', 400);

  const customer = await prisma.user.findUnique({ where: { id: customerId } });
  if (!customer) throw new AppError('Usuário não encontrado.', 401);

  const itemsData: {
    productId: string;
    partnerId: string;
    productTitle: string;
    imageUrl: string;
    category: string;
    unitPrice: number;
    quantity: number;
    cashbackPercent: number;
    lineTotal: number;
    cashbackEarned: number;
  }[] = [];
  let paidPrice = 0;
  let cashbackEarned = 0;

  for (const [productId, qty] of merged) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new AppError('Produto não encontrado.', 404);
    if (!product.active) throw new AppError(`Produto indisponível: ${product.title}.`, 409);
    if (product.stock < qty) throw new AppError(`Estoque insuficiente para ${product.title}.`, 409);

    const price = product.price.toNumber();
    const cbPercent = product.cashbackPercent.toNumber();
    const lineTotal = price * qty;
    const lineCashback = cashbackFor(lineTotal, cbPercent);

    itemsData.push({
      productId: product.id,
      partnerId: product.partnerId,
      productTitle: product.title,
      imageUrl: product.imageUrl,
      category: product.category,
      unitPrice: price,
      quantity: qty,
      cashbackPercent: cbPercent,
      lineTotal,
      cashbackEarned: lineCashback,
    });
    paidPrice += lineTotal;
    cashbackEarned += lineCashback;
  }

  const cashbackUsed = req.useCashback ? Math.min(Math.round(customer.cashbackBalance.toNumber() * 100) / 100, paidPrice) : 0;

  // Código de afiliado (motorista) digitado no checkout — só grava se bater
  // com pelo menos UMA loja do carrinho; senão erro exato pedido pelo
  // stakeholder (orderService.createOrder é o único lugar onde ele é
  // validado, distinto por-parceiro no crédito real em paymentService.approve).
  let affiliateDriverId: string | null = null;
  if (req.affiliateCode) {
    const distinctPartnerIds = [...new Set(itemsData.map((i) => i.partnerId))];
    affiliateDriverId = await driverAffiliateService.resolveCheckoutCode(req.affiliateCode, distinctPartnerIds);
  }

  const order = await prisma.order.create({
    data: {
      code: generateCode(),
      customerId,
      status: 'PendingPayment',
      paidPrice,
      cashbackEarned,
      cashbackUsed,
      affiliateCode: affiliateDriverId ? req.affiliateCode : null,
      affiliateDriverId,
      items: { create: itemsData },
    },
    include: orderInclude,
  });

  return toOrderDto(order);
}

export async function myOrders(customerId: string, status?: string): Promise<OrderDto[]> {
  const parsed = tryParseOrderStatus(status);
  const list = await prisma.order.findMany({
    where: { customerId, ...(parsed ? { status: parsed } : {}) },
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
  });
  return list.map(toOrderDto);
}

export async function getMyOrder(customerId: string, orderId: string): Promise<OrderDto> {
  const o = await prisma.order.findFirst({ where: { id: orderId, customerId }, include: orderInclude });
  if (!o) throw new AppError('Pedido não encontrado.', 404);
  return toOrderDto(o);
}

export async function cashbackEntries(customerId: string): Promise<CashbackEntryDto[]> {
  const entries = await prisma.cashbackEntry.findMany({
    where: { userId: customerId },
    include: { order: true },
    orderBy: { createdAt: 'desc' },
  });
  return entries.map(toCashbackEntryDto);
}

