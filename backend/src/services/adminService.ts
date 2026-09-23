import type { NamedValue, PagedResult, SeriesPoint } from '../dtos/common.dto.js';
import { toPage } from '../dtos/common.dto.js';
import type {
  AdminMetricsDto,
  AuditLogDto,
  CreatePayoutRequest,
  PartnerPayoutDto,
  PartnerPayoutSummaryDto,
  TopPartner,
} from '../dtos/admin.dto.js';
import type {
  AdminUserCreateRequest,
  AdminUserUpdateRequest,
  UserDto,
} from '../dtos/auth.dto.js';
import type { OrderDto } from '../dtos/orders.dto.js';
import type { PartnerDto, PartnerUpsertRequest } from '../dtos/catalog.dto.js';
import { partnerNet, platformFeeFor, round2 } from '../domain/commissionRules.js';
import { AppError } from '../errors.js';
import { hashPassword } from '../infra/auth/passwordHasher.js';
import { prisma } from '../infra/prisma.js';
import { toAuditLogDto, toOrderDto, toPartnerDto, toUserDto, tryParseOrderStatus } from '../mappings.js';

function dicebearIcon(seed: string): string {
  return `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(seed)}`;
}
function dicebearAvatar(seed: string): string {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

const orderInclude = { customer: true, items: { include: { partner: true } } } as const;

export async function metrics(): Promise<AdminMetricsDto> {
  const all = await prisma.order.findMany();
  // Pedido pode ter vários parceiros → métricas de receita/repasse por item.
  const validItems = await prisma.orderItem.findMany({
    where: { order: { status: { in: ['Paid', 'Redeemed'] } } },
    include: { order: true, partner: true },
  });

  const valid = all.filter((o) => o.status === 'Paid' || o.status === 'Redeemed');
  const gmv = valid.reduce((acc, o) => acc + o.paidPrice.toNumber(), 0);
  const net = validItems.reduce(
    (acc, i) =>
      acc +
      platformFeeFor(i.lineTotal.toNumber(), i.partner?.feePercent.toNumber() ?? 10) -
      i.cashbackEarned.toNumber(),
    0,
  );

  const customers = await prisma.user.count({ where: { role: 'Client' } });
  const partnersTotal = await prisma.partner.count();
  const partnersActive = await prisma.partner.count({ where: { active: true } });
  const cashbackAgg = await prisma.user.aggregate({
    where: { role: 'Client' },
    _sum: { cashbackBalance: true },
  });
  const cashbackOutstanding = cashbackAgg._sum.cashbackBalance?.toNumber() ?? 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ordersToday = all.filter((o) => o.createdAt >= today).length;
  const newCustomers30 = await prisma.user.count({ where: { role: 'Client', createdAt: { gte: since30 } } });

  const pendingCount = all.filter((o) => o.status === 'PendingPayment').length;
  const paidCount = all.filter((o) => o.status === 'Paid').length;
  const redeemedCount = all.filter((o) => o.status === 'Redeemed').length;
  const cancelledCount = all.filter((o) => o.status === 'Cancelled').length;

  const paymentDenom = paidCount + redeemedCount + cancelledCount;
  const paymentConversion = paymentDenom > 0 ? round2((100 * (paidCount + redeemedCount)) / paymentDenom) : 0;
  const redemptionRate = paidCount + redeemedCount > 0 ? round2((100 * redeemedCount) / (paidCount + redeemedCount)) : 0;
  const avgTicket = valid.length > 0 ? round2(gmv / valid.length) : 0;

  const byMonthMap = new Map<string, { label: string; value: number; sortKey: number }>();
  for (const o of valid) {
    const key = `${o.createdAt.getUTCFullYear()}-${o.createdAt.getUTCMonth()}`;
    const label = o.createdAt.toLocaleString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' });
    const entry = byMonthMap.get(key) ?? { label, value: 0, sortKey: o.createdAt.getUTCFullYear() * 12 + o.createdAt.getUTCMonth() };
    entry.value += o.paidPrice.toNumber();
    byMonthMap.set(key, entry);
  }
  const byMonth: SeriesPoint[] = [...byMonthMap.values()]
    .sort((a, b) => a.sortKey - b.sortKey)
    .map((v) => ({ label: v.label, value: round2(v.value) }));

  const topMap = new Map<string, { partnerId: string; partnerName: string; revenue: number }>();
  for (const i of validItems) {
    const entry = topMap.get(i.partnerId) ?? { partnerId: i.partnerId, partnerName: i.partner?.name ?? '', revenue: 0 };
    entry.revenue += i.lineTotal.toNumber();
    topMap.set(i.partnerId, entry);
  }
  const top: TopPartner[] = [...topMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5).map((t) => ({
    ...t,
    revenue: round2(t.revenue),
  }));

  const byCategory = groupItemsNamed(validItems, (i) => (i.category.length === 0 ? '—' : i.category)).sort(
    (a, b) => b.value - a.value,
  );

  const methodLabel = (m: string | null) =>
    m === 'Pix' ? 'Pix' : m === 'CreditCard' ? 'Crédito' : m === 'DebitCard' ? 'Débito' : 'Outro';
  const byMethodMap = new Map<string, { value: number; count: number }>();
  for (const o of valid) {
    const key = methodLabel(o.paymentMethod);
    const entry = byMethodMap.get(key) ?? { value: 0, count: 0 };
    entry.value += o.paidPrice.toNumber();
    entry.count += 1;
    byMethodMap.set(key, entry);
  }
  const byMethod: NamedValue[] = [...byMethodMap.entries()]
    .map(([name, v]) => ({ name, value: round2(v.value), count: v.count }))
    .sort((a, b) => b.value - a.value);

  const leads = await prisma.assistantLead.findMany();
  const leadsByTemp: NamedValue[] = (['Quente', 'Morno', 'Frio'] as const).map((t) => {
    const label = t === 'Quente' ? 'Quente' : t === 'Morno' ? 'Morno' : 'Frio';
    const matching = leads.filter((l) => l.temperature === t);
    return { name: label, value: matching.reduce((acc, l) => acc + l.score, 0), count: matching.length };
  });

  return {
    gmv: round2(gmv),
    netRevenue: round2(net),
    customers,
    partners: partnersTotal,
    activePartners: partnersActive,
    ordersToday,
    averageTicket: avgTicket,
    cashbackOutstanding: round2(cashbackOutstanding),
    newCustomers30d: newCustomers30,
    pendingCount,
    paidCount,
    redeemedCount,
    cancelledCount,
    paymentConversion,
    redemptionRate,
    revenueByMonth: byMonth,
    topPartners: top,
    salesByCategory: byCategory,
    paymentMethods: byMethod,
    leadsByTemperature: leadsByTemp,
  };
}

function groupItemsNamed<T extends { category: string; lineTotal: { toNumber(): number }; quantity: number }>(
  items: T[],
  keyOf: (i: T) => string,
): NamedValue[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const item of items) {
    const key = keyOf(item);
    const entry = map.get(key) ?? { value: 0, count: 0 };
    entry.value += item.lineTotal.toNumber();
    entry.count += item.quantity;
    map.set(key, entry);
  }
  return [...map.entries()].map(([name, v]) => ({ name, value: round2(v.value), count: v.count }));
}

export async function sales(
  partnerId: string | undefined,
  status: string | undefined,
  q: string | undefined,
  page: number,
  pageSize: number,
): Promise<PagedResult<OrderDto>> {
  const parsedStatus = tryParseOrderStatus(status);
  const where = {
    ...(partnerId ? { items: { some: { partnerId } } } : {}),
    ...(parsedStatus ? { status: parsedStatus } : {}),
    ...(q
      ? {
          OR: [
            { customer: { name: { contains: q, mode: 'insensitive' as const } } },
            { items: { some: { productTitle: { contains: q, mode: 'insensitive' as const } } } },
            { code: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const total = await prisma.order.count({ where });
  const rows = await prisma.order.findMany({
    where,
    include: orderInclude,
    orderBy: { createdAt: 'desc' },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });
  return toPage(rows.map(toOrderDto), total, safePage, safePageSize);
}

export async function partners(page: number, pageSize: number): Promise<PagedResult<PartnerDto>> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const total = await prisma.partner.count();
  const rows = await prisma.partner.findMany({
    orderBy: { name: 'asc' },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });
  return toPage(rows.map(toPartnerDto), total, safePage, safePageSize);
}

export async function createPartner(req: PartnerUpsertRequest): Promise<PartnerDto> {
  const p = await prisma.partner.create({
    data: {
      name: req.name,
      segment: req.segment,
      logoUrl: req.logoUrl?.trim() ? req.logoUrl : dicebearIcon(req.name),
      feePercent: req.feePercent,
      active: req.active,
      cnpj: req.cnpj?.trim() ?? '',
      documentType: req.documentType ?? 'CNPJ',
      city: req.city?.trim() ?? '',
      state: req.state?.trim() ?? '',
      lat: req.lat ?? 0,
      lng: req.lng ?? 0,
      asaasWalletId: req.asaasWalletId?.trim() ? req.asaasWalletId.trim() : null,
      evolutionInstance: req.evolutionInstance?.trim() ? req.evolutionInstance.trim() : null,
    },
  });
  return toPartnerDto(p);
}

export async function updatePartner(id: string, req: PartnerUpsertRequest): Promise<PartnerDto> {
  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) throw new AppError('Parceiro não encontrado.', 404);
  const p = await prisma.partner.update({
    where: { id },
    data: {
      name: req.name,
      segment: req.segment,
      logoUrl: req.logoUrl,
      feePercent: req.feePercent,
      active: req.active,
      ...(req.cnpj != null ? { cnpj: req.cnpj.trim() } : {}),
      ...(req.documentType != null ? { documentType: req.documentType } : {}),
      ...(req.city != null ? { city: req.city.trim() } : {}),
      ...(req.state != null ? { state: req.state.trim() } : {}),
      ...(req.lat != null ? { lat: req.lat } : {}),
      ...(req.lng != null ? { lng: req.lng } : {}),
      // null = não mexe; string vazia = limpa (volta a repasse manual).
      ...(req.asaasWalletId !== undefined
        ? { asaasWalletId: req.asaasWalletId?.trim() ? req.asaasWalletId.trim() : null }
        : {}),
      ...(req.evolutionInstance !== undefined
        ? { evolutionInstance: req.evolutionInstance?.trim() ? req.evolutionInstance.trim() : null }
        : {}),
    },
  });
  return toPartnerDto(p);
}

export async function deletePartner(id: string): Promise<void> {
  const existing = await prisma.partner.findUnique({ where: { id } });
  if (!existing) throw new AppError('Parceiro não encontrado.', 404);
  await prisma.partner.update({ where: { id }, data: { active: false } });
}

export async function users(q: string | undefined, page: number, pageSize: number): Promise<PagedResult<UserDto>> {
  const where = q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { email: { contains: q, mode: 'insensitive' as const } }] } : {};
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const total = await prisma.user.count({ where });
  const rows = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });
  return toPage(rows.map(toUserDto), total, safePage, safePageSize);
}

// Vínculo de parceiro: obrigatório quando o papel é Partner; cliente/admin
// nunca têm parceiro.
async function resolvePartnerLink(role: string, partnerId: string | null | undefined): Promise<string | null> {
  if (role !== 'Partner') return null;
  if (!partnerId) throw new AppError('Usuário parceiro precisa estar vinculado a um parceiro.', 400);
  if (!(await prisma.partner.findUnique({ where: { id: partnerId } })))
    throw new AppError('Parceiro vinculado não encontrado.', 404);
  return partnerId;
}

function capitalizeRole(role: string): 'Client' | 'Passenger' | 'Driver' | 'Partner' | 'Admin' | 'Financeiro' {
  const v = role.toLowerCase();
  if (v === 'passenger') return 'Passenger';
  if (v === 'driver') return 'Driver';
  if (v === 'partner') return 'Partner';
  if (v === 'admin') return 'Admin';
  if (v === 'financeiro') return 'Financeiro';
  return 'Client';
}

export async function createUser(req: AdminUserCreateRequest): Promise<UserDto> {
  const email = req.email.trim().toLowerCase();
  if (!req.name.trim()) throw new AppError('Nome é obrigatório.', 400);
  if (!email) throw new AppError('E-mail é obrigatório.', 400);
  if (!req.password || req.password.length < 6) throw new AppError('A senha deve ter pelo menos 6 caracteres.', 400);
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError('E-mail já está em uso.', 409);
  const role = capitalizeRole(req.role);

  const partnerId = await resolvePartnerLink(role, req.partnerId);

  const user = await prisma.user.create({
    data: {
      name: req.name.trim(),
      email,
      passwordHash: hashPassword(req.password),
      phone: req.phone,
      role,
      cashbackBalance: round2(req.cashbackBalance),
      partnerId,
      avatarUrl: dicebearAvatar(req.name),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'admin.user.create',
      entityType: 'User',
      entityId: user.id,
      payloadJson: JSON.stringify({ email: user.email, role }),
    },
  });

  return toUserDto(user);
}

export async function updateUser(id: string, req: AdminUserUpdateRequest): Promise<UserDto> {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new AppError('Usuário não encontrado.', 404);

  const email = req.email.trim().toLowerCase();
  if (!req.name.trim()) throw new AppError('Nome é obrigatório.', 400);
  if (!email) throw new AppError('E-mail é obrigatório.', 400);
  if (await prisma.user.findFirst({ where: { email, id: { not: id } } }))
    throw new AppError('E-mail já está em uso.', 409);
  const role = capitalizeRole(req.role);

  const partnerId = await resolvePartnerLink(role, req.partnerId);

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: req.name.trim(),
      email,
      phone: req.phone,
      role,
      cashbackBalance: round2(req.cashbackBalance),
      partnerId,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: 'admin.user.update',
      entityType: 'User',
      entityId: id,
      payloadJson: JSON.stringify({ email: user.email, role }),
    },
  });

  return toUserDto(user);
}

export async function auditLogs(
  from: Date | undefined,
  to: Date | undefined,
  userId: string | undefined,
  action: string | undefined,
  page: number,
  pageSize: number,
): Promise<PagedResult<AuditLogDto>> {
  const where = {
    ...(from ? { createdAt: { gte: from } } : {}),
    ...(to ? { createdAt: { lte: to } } : {}),
    ...(userId ? { actorId: userId } : {}),
    ...(action ? { action: { contains: action, mode: 'insensitive' as const } } : {}),
  };
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const total = await prisma.auditLog.count({ where });
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const actorNames = new Map(actors.map((a) => [a.id, a.name]));
  return toPage(rows.map((r) => toAuditLogDto(r, r.actorId ? (actorNames.get(r.actorId) ?? null) : null)), total, safePage, safePageSize);
}

// Líquido devido ao parceiro = soma do PartnerNet dos itens já resgatados.
async function earnedNet(partnerId: string, fee: number): Promise<number> {
  const redeemed = await prisma.orderItem.findMany({
    where: { partnerId, redeemedAt: { not: null } },
    select: { lineTotal: true, cashbackEarned: true },
  });
  return redeemed.reduce(
    (acc, r) => acc + partnerNet(r.lineTotal.toNumber(), platformFeeFor(r.lineTotal.toNumber(), fee), r.cashbackEarned.toNumber()),
    0,
  );
}

export async function payoutSummary(): Promise<PartnerPayoutSummaryDto[]> {
  const partnerRows = await prisma.partner.findMany({ orderBy: { name: 'asc' } });
  const redeemed = await prisma.orderItem.findMany({
    where: { redeemedAt: { not: null } },
    select: { partnerId: true, lineTotal: true, cashbackEarned: true },
  });
  const paidByPartner = await prisma.partnerPayout.groupBy({ by: ['partnerId'], _sum: { amount: true } });
  const paidMap = new Map(paidByPartner.map((p) => [p.partnerId, p._sum.amount?.toNumber() ?? 0]));

  return partnerRows.map((p) => {
    const net = round2(
      redeemed
        .filter((r) => r.partnerId === p.id)
        .reduce(
          (acc, r) => acc + partnerNet(r.lineTotal.toNumber(), platformFeeFor(r.lineTotal.toNumber(), p.feePercent.toNumber()), r.cashbackEarned.toNumber()),
          0,
        ),
    );
    const paid = round2(paidMap.get(p.id) ?? 0);
    return { partnerId: p.id, partnerName: p.name, earnedNet: net, paid, available: Math.max(0, round2(net - paid)) };
  });
}

export async function payouts(partnerId: string | undefined, page: number, pageSize: number): Promise<PagedResult<PartnerPayoutDto>> {
  const where = partnerId ? { partnerId } : {};
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const total = await prisma.partnerPayout.count({ where });
  const rows = await prisma.partnerPayout.findMany({
    where,
    include: { partner: true },
    orderBy: { createdAt: 'desc' },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });
  return toPage(
    rows.map((p) => ({
      id: p.id,
      partnerId: p.partnerId,
      partnerName: p.partner.name,
      amount: p.amount.toNumber(),
      periodStart: p.periodStart,
      periodEnd: p.periodEnd,
      note: p.note,
      createdAt: p.createdAt,
    })),
    total,
    safePage,
    safePageSize,
  );
}

export async function createPayout(actorId: string, req: CreatePayoutRequest): Promise<PartnerPayoutDto> {
  const partner = await prisma.partner.findUnique({ where: { id: req.partnerId } });
  if (!partner) throw new AppError('Parceiro não encontrado.', 404);
  const amount = round2(req.amount);
  if (amount <= 0) throw new AppError('Valor deve ser maior que zero.', 400);
  if (req.periodEnd.getTime() < req.periodStart.getTime())
    throw new AppError('Período inválido (fim antes do início).', 400);

  const net = await earnedNet(partner.id, partner.feePercent.toNumber());
  const alreadyPaidAgg = await prisma.partnerPayout.aggregate({ where: { partnerId: partner.id }, _sum: { amount: true } });
  const alreadyPaid = alreadyPaidAgg._sum.amount?.toNumber() ?? 0;
  const available = round2(net - alreadyPaid);
  if (amount > available + 0.01) throw new AppError(`Valor acima do disponível para repasse (R$ ${available.toFixed(2)}).`, 400);

  const payout = await prisma.partnerPayout.create({
    data: {
      partnerId: partner.id,
      amount,
      periodStart: req.periodStart,
      periodEnd: req.periodEnd,
      note: (req.note ?? '').trim(),
      createdBy: actorId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'admin.payout.create',
      entityType: 'PartnerPayout',
      entityId: payout.id,
      payloadJson: JSON.stringify({ id: partner.id, name: partner.name, amount, periodStart: req.periodStart, periodEnd: req.periodEnd }),
    },
  });

  // Notifica o(s) usuário(s) do parceiro, se houver.
  const partnerUsers = await prisma.user.findMany({ where: { partnerId: partner.id }, select: { id: true } });
  if (partnerUsers.length > 0) {
    await prisma.notification.createMany({
      data: partnerUsers.map((u) => ({
        userId: u.id,
        title: 'Repasse recebido',
        message: `Repasse de R$ ${amount.toFixed(2)} creditado (${formatDate(req.periodStart)} a ${formatDate(req.periodEnd)}).`,
      })),
    });
  }

  return {
    id: payout.id,
    partnerId: partner.id,
    partnerName: partner.name,
    amount: payout.amount.toNumber(),
    periodStart: payout.periodStart,
    periodEnd: payout.periodEnd,
    note: payout.note,
    createdAt: payout.createdAt,
  };
}

function formatDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
