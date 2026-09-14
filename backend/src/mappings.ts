import type { Prisma } from '@prisma/client';
import type { UserDto, NotificationDto } from './dtos/auth.dto.js';
import type { ProductDto, PartnerDto, StoreDto, CategoryDto } from './dtos/catalog.dto.js';
import type { OrderDto, OrderItemDto, CashbackEntryDto } from './dtos/orders.dto.js';
import type { AuditLogDto } from './dtos/admin.dto.js';
import type {
  AffiliateApplicationDto,
  AffiliatePartnerDto,
  CampaignMaterialDto,
  CommissionEntryDto,
  ServiceApiKeyDto,
  WithdrawalRequestDto,
} from './dtos/affiliate.dto.js';

type UserRow = Prisma.UserGetPayload<{}>;
export function toUserDto(u: UserRow): UserDto {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role.toLowerCase(),
    cashbackBalance: u.cashbackBalance.toNumber(),
    avatarUrl: u.avatarUrl,
    partnerId: u.partnerId,
    phone: u.phone,
    cpf: u.cpf,
    emailVerifiedAt: u.emailVerifiedAt,
    notifyWhatsApp: u.notifyWhatsApp,
    notifyEmail: u.notifyEmail,
    notifyPromo: u.notifyPromo,
  };
}

type ProductRow = Prisma.ProductGetPayload<{ include: { partner: true } }>;
export function toProductDto(p: ProductRow, cities: string[] = [], states: string[] = []): ProductDto {
  return {
    id: p.id,
    partnerId: p.partnerId,
    partnerName: p.partner?.name ?? '',
    title: p.title,
    description: p.description,
    price: p.price.toNumber(),
    cashbackPercent: p.cashbackPercent.toNumber(),
    kind: p.kind.toLowerCase(),
    imageUrl: p.imageUrl,
    category: p.category,
    rating: p.rating,
    stock: p.stock,
    digital: p.kind === 'Digital',
    cities,
    states,
  };
}

type PartnerRow = Prisma.PartnerGetPayload<{}>;
export function toPartnerDto(p: PartnerRow): PartnerDto {
  return {
    id: p.id,
    name: p.name,
    segment: p.segment,
    logoUrl: p.logoUrl,
    active: p.active,
    feePercent: p.feePercent.toNumber(),
    joinedAt: p.joinedAt,
    cnpj: p.cnpj,
    city: p.city,
    state: p.state,
    lat: p.lat,
    lng: p.lng,
    asaasWalletId: p.asaasWalletId,
    evolutionInstance: p.evolutionInstance,
  };
}

type StoreRow = Prisma.PartnerStoreGetPayload<{}>;
export function toStoreDto(s: StoreRow): StoreDto {
  return {
    id: s.id,
    partnerId: s.partnerId,
    name: s.name,
    address: s.address,
    city: s.city,
    state: s.state,
    lat: s.lat,
    lng: s.lng,
    category: s.category,
    imageUrl: s.imageUrl,
  };
}

type CategoryRow = Prisma.CategoryGetPayload<{}>;
export function toCategoryDto(c: CategoryRow): CategoryDto {
  return { id: c.id, name: c.name, type: c.type.toLowerCase(), active: c.active };
}

type NotificationRow = Prisma.NotificationGetPayload<{}>;
export function toNotificationDto(n: NotificationRow): NotificationDto {
  return {
    id: n.id,
    title: n.title,
    message: n.message,
    channel: n.channel,
    read: n.readAt !== null,
    createdAt: n.createdAt,
  };
}

type AuditLogRow = Prisma.AuditLogGetPayload<{}>;
export function toAuditLogDto(a: AuditLogRow, actorName: string | null = null): AuditLogDto {
  return {
    id: a.id,
    actorId: a.actorId,
    actorName,
    action: a.action,
    entityType: a.entityType,
    entityId: a.entityId,
    payloadJson: a.payloadJson,
    createdAt: a.createdAt,
  };
}

type CashbackEntryRow = Prisma.CashbackEntryGetPayload<{ include: { order: true } }>;
export function toCashbackEntryDto(e: CashbackEntryRow): CashbackEntryDto {
  return {
    id: e.id,
    type: e.type === 'Earned' ? 'earned' : 'used',
    amount: e.amount.toNumber(),
    orderId: e.orderId,
    orderCode: e.order?.code ?? null,
    description: e.description,
    createdAt: e.createdAt,
  };
}

type OrderItemRow = Prisma.OrderItemGetPayload<{ include: { partner: true } }>;
export function toOrderItemDto(i: OrderItemRow): OrderItemDto {
  return {
    id: i.id,
    productId: i.productId,
    productTitle: i.productTitle,
    imageUrl: i.imageUrl,
    category: i.category,
    partnerId: i.partnerId,
    partnerName: i.partner?.name ?? '',
    unitPrice: i.unitPrice.toNumber(),
    quantity: i.quantity,
    lineTotal: i.lineTotal.toNumber(),
    cashbackEarned: i.cashbackEarned.toNumber(),
    redeemed: i.redeemedAt !== null,
    redeemedAt: i.redeemedAt,
  };
}

type OrderRow = Prisma.OrderGetPayload<{
  include: { customer: true; items: { include: { partner: true } } };
}>;
export function toOrderDto(o: OrderRow): OrderDto {
  const items = (o.items ?? []).map(toOrderItemDto);
  const first = items[0];
  const productId = first?.productId ?? '';
  const productTitle =
    items.length === 0 ? '' : items.length === 1 ? first!.productTitle : `${first!.productTitle} +${items.length - 1}`;
  const partnerId = first?.partnerId ?? '';
  const distinctPartners = new Set(items.map((i) => i.partnerName));
  const partnerName = distinctPartners.size > 1 ? 'Vários parceiros' : (first?.partnerName ?? '');

  const statusMap: Record<string, string> = {
    PendingPayment: 'pending',
    Paid: 'paid',
    Redeemed: 'redeemed',
    Cancelled: 'cancelled',
  };

  return {
    id: o.id,
    code: o.code,
    productId,
    productTitle,
    partnerId,
    partnerName,
    customerId: o.customerId,
    customerName: o.customer?.name ?? '',
    paidPrice: o.paidPrice.toNumber(),
    cashbackEarned: o.cashbackEarned.toNumber(),
    cashbackUsed: o.cashbackUsed.toNumber(),
    status: statusMap[o.status] ?? 'cancelled',
    createdAt: o.createdAt,
    redeemedAt: o.redeemedAt,
    items,
  };
}

export function parseCategoryType(s: string | undefined): 'Product' | 'Store' {
  return (s ?? '').toLowerCase() === 'store' ? 'Store' : 'Product';
}

export function parseProductKind(s: string): 'Physical' | 'Digital' | 'Voucher' {
  const v = s.toLowerCase();
  if (v === 'digital') return 'Digital';
  if (v === 'physical') return 'Physical';
  return 'Voucher';
}

const ORDER_STATUS_VALUES = ['PendingPayment', 'Paid', 'Redeemed', 'Cancelled'] as const;
export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number];

/** Equivalente a Enum.TryParse<OrderStatus>(s, ignoreCase: true) — casa pelo
 * NOME do enum (ex.: "PendingPayment"), não pelo valor exposto no DTO
 * ("pending"). Retorna undefined se não casar (o filtro é então ignorado,
 * igual ao comportamento original). */
export function tryParseOrderStatus(s: string | undefined): OrderStatusValue | undefined {
  if (!s) return undefined;
  return ORDER_STATUS_VALUES.find((v) => v.toLowerCase() === s.toLowerCase());
}

export function parsePaymentMethod(s: string): 'Pix' | 'CreditCard' | 'DebitCard' {
  const v = s.toLowerCase();
  if (v === 'credit_card' || v === 'credit') return 'CreditCard';
  if (v === 'debit_card' || v === 'debit') return 'DebitCard';
  return 'Pix';
}

// ---------- Afiliados (programa solar) ----------
type AffiliatePartnerRow = Prisma.PartnerGetPayload<{}>;
export function toAffiliatePartnerDto(p: AffiliatePartnerRow): AffiliatePartnerDto {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind === 'SolarAffiliate' ? 'solar_affiliate' : 'marketplace',
    referralCode: p.referralCode,
    commissionBalance: p.commissionBalance.toNumber(),
    linkViews: p.linkViews,
    linkLeads: p.linkLeads,
    linkSales: p.linkSales,
    active: p.active,
    ownedByCompany: p.ownedByCompany,
    pixKey: p.pixKey,
    pixKeyType: p.pixKeyType,
    segment: p.segment,
    logoUrl: p.logoUrl,
    cnpj: p.cnpj,
    city: p.city,
    state: p.state,
    lat: p.lat,
    lng: p.lng,
    evolutionInstance: p.evolutionInstance,
  };
}

type CommissionEntryRow = Prisma.AffiliateCommissionEntryGetPayload<{}>;
export function toCommissionEntryDto(e: CommissionEntryRow): CommissionEntryDto {
  return {
    id: e.id,
    partnerId: e.partnerId,
    type: e.type === 'Credit' ? 'credit' : 'debit',
    amount: e.amount.toNumber(),
    description: e.description,
    externalReference: e.externalReference,
    createdAt: e.createdAt,
  };
}

type WithdrawalRequestRow = Prisma.WithdrawalRequestGetPayload<{ include: { partner: true } }>;
export function toWithdrawalRequestDto(w: WithdrawalRequestRow): WithdrawalRequestDto {
  return {
    id: w.id,
    partnerId: w.partnerId,
    partnerName: w.partner.name,
    amount: w.amount.toNumber(),
    status: w.status.toLowerCase(),
    note: w.note,
    pixKey: w.pixKey,
    pixKeyType: w.pixKeyType,
    requestedAt: w.requestedAt,
    resolvedAt: w.resolvedAt,
  };
}

type CampaignMaterialRow = Prisma.CampaignMaterialGetPayload<{}>;
export function toCampaignMaterialDto(m: CampaignMaterialRow): CampaignMaterialDto {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    fileUrl: m.fileUrl,
    active: m.active,
    createdAt: m.createdAt,
  };
}

type AffiliateApplicationRow = Prisma.AffiliateApplicationGetPayload<{}>;
export function toAffiliateApplicationDto(a: AffiliateApplicationRow): AffiliateApplicationDto {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    phone: a.phone,
    city: a.city,
    state: a.state,
    message: a.message,
    status: a.status.toLowerCase(),
    createdAt: a.createdAt,
    resolvedAt: a.resolvedAt,
  };
}

const APPLICATION_STATUS_VALUES = ['Pending', 'Approved', 'Rejected'] as const;
export function tryParseApplicationStatus(s: string | undefined): (typeof APPLICATION_STATUS_VALUES)[number] | undefined {
  if (!s) return undefined;
  return APPLICATION_STATUS_VALUES.find((v) => v.toLowerCase() === s.toLowerCase());
}

const WITHDRAWAL_STATUS_VALUES = ['Pending', 'Approved', 'Rejected', 'Paid'] as const;
export function tryParseWithdrawalStatus(s: string | undefined): (typeof WITHDRAWAL_STATUS_VALUES)[number] | undefined {
  if (!s) return undefined;
  return WITHDRAWAL_STATUS_VALUES.find((v) => v.toLowerCase() === s.toLowerCase());
}

type ServiceApiKeyRow = Prisma.ServiceApiKeyGetPayload<{}>;
export function toServiceApiKeyDto(k: ServiceApiKeyRow): ServiceApiKeyDto {
  return {
    id: k.id,
    label: k.label,
    keyPreview: k.keyPreview,
    scopes: k.scopes,
    active: k.active,
    lastUsedAt: k.lastUsedAt,
    createdAt: k.createdAt,
  };
}
