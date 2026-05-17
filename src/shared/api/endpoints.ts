import { api, SERVER_ORIGIN, tokenStore } from './client';
import {
  Product,
  PartnerStore,
  Partner,
  Order,
  User,
  Category,
  AppNotification,
  CashbackEntry,
  ProductReviews,
  ReviewEligibility,
  ReviewItem,
} from '@shared/types';

export interface CatalogQuery {
  category?: string;
  q?: string;
  city?: string;
  state?: string;
  partnerId?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating';
  page?: number;
  pageSize?: number;
}
export interface CatalogResult {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface CatalogFilters {
  categories: string[];
  cities: string[];
  states: string[];
  minPrice: number;
  maxPrice: number;
}

export interface SeriesPoint {
  label: string;
  value: number;
}
export interface NamedValue {
  name: string;
  value: number;
  count: number;
}
export interface PartnerMetrics {
  totalRevenue: number;
  totalSales: number;
  pendingTransfer: number;
  paidTransfer: number;
  averageTicket: number;
  cashbackGranted: number;
  uniqueCustomers: number;
  pendingCount: number;
  paidCount: number;
  redeemedCount: number;
  redemptionRate: number;
  salesByHour: SeriesPoint[];
  revenueLastDays: SeriesPoint[];
  topProducts: NamedValue[];
  salesByCategory: NamedValue[];
  paymentMethods: NamedValue[];
}
export interface TopPartner {
  partnerId: string;
  partnerName: string;
  revenue: number;
}
export interface AdminMetrics {
  gmv: number;
  netRevenue: number;
  customers: number;
  partners: number;
  activePartners: number;
  ordersToday: number;
  averageTicket: number;
  cashbackOutstanding: number;
  newCustomers30d: number;
  pendingCount: number;
  paidCount: number;
  redeemedCount: number;
  cancelledCount: number;
  paymentConversion: number;
  redemptionRate: number;
  revenueByMonth: SeriesPoint[];
  topPartners: TopPartner[];
  salesByCategory: NamedValue[];
  paymentMethods: NamedValue[];
  leadsByTemperature: NamedValue[];
}
export interface LeadDto {
  id: string;
  lead: {
    profile?: string;
    category?: string;
    goal?: string;
    mainIntent?: string;
    score: number;
    temperature: string;
  };
  createdAt: string;
}
export interface AuditLogDto {
  id: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  payloadJson?: string;
  createdAt: string;
}

// ---- Auth ----
export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}
export const authApi = {
  login: (email: string, password: string) =>
    api.postPublic<AuthResponse>('/auth/login', { email, password }),
  register: (body: {
    name: string;
    email: string;
    password: string;
    cpf?: string;
    phone?: string;
  }) => api.postPublic<AuthResponse>('/auth/register', body),
  registerPartner: (body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    storeName: string;
    segment: string;
    cnpj?: string;
    city?: string;
    state?: string;
    lat?: number;
    lng?: number;
  }) => api.postPublic<AuthResponse>('/auth/register/partner', body),
  me: () => api.get<User>('/auth/me'),
  updateProfile: (body: {
    name: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
  }) => api.put<User>('/me/profile', body),
  updateNotifications: (body: {
    whatsApp: boolean;
    email: boolean;
    promo: boolean;
  }) => api.put<void>('/me/notifications', body),
  notifications: () => api.get<AppNotification[]>('/me/notifications'),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.put<void>('/me/password', body),
};

// ---- Catalog ----
export const catalogApi = {
  products: (params?: { category?: string; q?: string; partnerId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.q) qs.set('q', params.q);
    if (params?.partnerId) qs.set('partnerId', params.partnerId);
    const s = qs.toString();
    return api.get<Product[]>(`/products${s ? `?${s}` : ''}`);
  },
  product: (id: string) => api.get<Product>(`/products/${id}`),
  search: (params: CatalogQuery) => {
    const qs = new URLSearchParams();
    if (params.category && params.category !== 'Todos')
      qs.set('category', params.category);
    if (params.q) qs.set('q', params.q);
    if (params.city) qs.set('city', params.city);
    if (params.state) qs.set('state', params.state);
    if (params.partnerId) qs.set('partnerId', params.partnerId);
    if (params.minPrice != null) qs.set('minPrice', String(params.minPrice));
    if (params.maxPrice != null) qs.set('maxPrice', String(params.maxPrice));
    if (params.sort) qs.set('sort', params.sort);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    return api.get<CatalogResult>(`/catalog?${qs.toString()}`);
  },
  filters: () => api.get<CatalogFilters>('/catalog/filters'),
  categories: (type: 'product' | 'store' = 'product') =>
    api.get<Category[]>(`/categories?type=${type}`),
  stores: (partnerId?: string) =>
    api.get<PartnerStore[]>(
      `/stores${partnerId ? `?partnerId=${partnerId}` : ''}`,
    ),
  storesNearby: (lat: number, lng: number, radiusKm = 10, limit = 20) =>
    api.get<NearbyStore[]>(
      `/stores/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}&limit=${limit}`,
    ),
  partners: () => api.get<Partner[]>('/partners'),
  partner: (id: string) => api.get<Partner>(`/partners/${id}`),
};

export interface NearbyStore extends PartnerStore {
  distanceKm: number;
}

/** Upload de imagem (parceiro/admin). Retorna a URL pública absoluta. */
export const uploadsApi = {
  image: async (file: File): Promise<string> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${SERVER_ORIGIN}/api/v1/uploads/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenStore.get() ?? ''}` },
      body: form,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok)
      throw new Error(json?.error ?? `Falha no upload (${res.status})`);
    return json.data.url as string;
  },
};

// ---- Orders / Payments ----
export interface PixPayload {
  qrCode: string;
  copiaECola: string;
  ticketUrl: string;
  expiresAt: string;
}
export interface PaymentSnapshot {
  orderId: string;
  paymentId: string | null;
  paymentReference: string | null;
  paymentStatus: string;
  statusDetail: string | null;
  voucherCode: string | null;
  orderStatus: string;
  pix: PixPayload | null;
}
export const ordersApi = {
  create: (
    items: { productId: string; quantity: number }[],
    useCashback = false,
  ) => api.post<Order>('/orders', { items, useCashback }),
  myOrders: (status?: string) =>
    api.get<Order[]>(`/me/orders${status ? `?status=${status}` : ''}`),
  myOrder: (id: string) => api.get<Order>(`/me/orders/${id}`),
  cashbackEntries: () =>
    api.get<CashbackEntry[]>('/me/cashback/entries'),
};
export const reviewsApi = {
  forProduct: (productId: string) =>
    api.get<ProductReviews>(`/products/${productId}/reviews`),
  eligibility: (productId: string) =>
    api.get<ReviewEligibility>(
      `/me/reviews/eligibility?productId=${productId}`,
    ),
  create: (body: { productId: string; rating: number; comment?: string }) =>
    api.post<ReviewItem>('/reviews', body),
};
export const paymentsApi = {
  process: (body: {
    orderId: string;
    method: 'pix' | 'credit_card' | 'debit_card';
    card?: { number: string; holder: string; expiry: string; cvv: string } | null;
  }) => api.post<PaymentSnapshot>('/payments/process', body),
  status: (orderId: string) =>
    api.get<PaymentSnapshot>(`/orders/${orderId}/payment-status`),
};

// ---- Partner ----
export interface ProductUpsert {
  title: string;
  description: string;
  price: number;
  cashbackPercent: number;
  kind: string;
  imageUrl: string;
  category: string;
  stock: number;
}
export interface StoreUpsert {
  partnerId?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  category: string;
  imageUrl?: string;
}
export interface RedeemResult {
  orderId: string;
  productTitle: string;
  customerName: string;
  paidPrice: number;
  feePercent: number;
  platformFee: number;
  customerCashback: number;
  partnerNet: number;
  redeemed: boolean;
}
export const partnerApi = {
  products: () => api.get<Product[]>('/partner/products'),
  createProduct: (body: ProductUpsert) =>
    api.post<Product>('/partner/products', body),
  updateProduct: (id: string, body: ProductUpsert) =>
    api.put<Product>(`/partner/products/${id}`, body),
  deleteProduct: (id: string) => api.del<void>(`/partner/products/${id}`),
  metrics: () => api.get<PartnerMetrics>('/partner/metrics'),
  stores: () => api.get<PartnerStore[]>('/partner/stores'),
  createStore: (body: StoreUpsert) =>
    api.post<PartnerStore>('/partner/stores', body),
  updateStore: (id: string, body: StoreUpsert) =>
    api.put<PartnerStore>(`/partner/stores/${id}`, body),
  deleteStore: (id: string) => api.del<void>(`/partner/stores/${id}`),
  redeem: (code: string, confirm: boolean) =>
    api.post<RedeemResult>(
      `/partner/redeem?confirm=${confirm}`,
      { code },
    ),
};

// ---- Admin ----
export interface PartnerUpsert {
  name: string;
  segment: string;
  logoUrl: string;
  feePercent: number;
  active: boolean;
  cnpj?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
}
export interface AdminUserUpdate {
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'partner' | 'admin';
  cashbackBalance: number;
  partnerId?: string | null;
}
export interface AdminUserCreate extends AdminUserUpdate {
  password: string;
}

export const adminApi = {
  metrics: () => api.get<AdminMetrics>('/admin/metrics'),
  sales: (params?: {
    partnerId?: string;
    status?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.partnerId) qs.set('partnerId', params.partnerId);
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    qs.set('page', String(params?.page ?? 1));
    qs.set('pageSize', String(params?.pageSize ?? 20));
    const s = qs.toString();
    return api.get<PagedResult<Order>>(`/admin/sales${s ? `?${s}` : ''}`);
  },
  partners: (params?: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    qs.set('page', String(params?.page ?? 1));
    qs.set('pageSize', String(params?.pageSize ?? 20));
    return api.get<PagedResult<Partner>>(`/admin/partners?${qs.toString()}`);
  },
  createPartner: (body: PartnerUpsert) =>
    api.post<Partner>('/admin/partners', body),
  updatePartner: (id: string, body: PartnerUpsert) =>
    api.put<Partner>(`/admin/partners/${id}`, body),
  deletePartner: (id: string) => api.del<void>(`/admin/partners/${id}`),
  stores: (partnerId?: string) =>
    api.get<PartnerStore[]>(
      `/admin/stores${partnerId ? `?partnerId=${partnerId}` : ''}`,
    ),
  createStore: (body: StoreUpsert) =>
    api.post<PartnerStore>('/admin/stores', body),
  updateStore: (id: string, body: StoreUpsert) =>
    api.put<PartnerStore>(`/admin/stores/${id}`, body),
  deleteStore: (id: string) => api.del<void>(`/admin/stores/${id}`),
  users: (params?: { q?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    qs.set('page', String(params?.page ?? 1));
    qs.set('pageSize', String(params?.pageSize ?? 20));
    return api.get<PagedResult<User>>(`/admin/users?${qs.toString()}`);
  },
  auditLogs: (params?: {
    from?: string;
    to?: string;
    userId?: string;
    action?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    if (params?.userId) qs.set('userId', params.userId);
    if (params?.action) qs.set('action', params.action);
    qs.set('page', String(params?.page ?? 1));
    qs.set('pageSize', String(params?.pageSize ?? 20));
    return api.get<PagedResult<AuditLogDto>>(`/admin/audit-logs?${qs.toString()}`);
  },
  createUser: (body: AdminUserCreate) =>
    api.post<User>('/admin/users', body),
  updateUser: (id: string, body: AdminUserUpdate) =>
    api.put<User>(`/admin/users/${id}`, body),
  leads: () => api.get<LeadDto[]>('/admin/leads'),
  integrations: () => api.get<IntegrationGroup[]>('/admin/integrations'),
  updateIntegration: (key: string, value: string | null) =>
    api.put<IntegrationGroup[]>('/admin/integrations', { key, value }),
  categories: () => api.get<Category[]>('/admin/categories'),
  createCategory: (
    name: string,
    type: 'product' | 'store' = 'product',
    active = true,
  ) => api.post<Category>('/admin/categories', { name, type, active }),
  updateCategory: (id: string, name: string, active: boolean) =>
    api.put<Category>(`/admin/categories/${id}`, { name, active }),
  deleteCategory: (id: string) =>
    api.del<void>(`/admin/categories/${id}`),
};

export interface IntegrationField {
  key: string;
  label: string;
  secret: boolean;
  hasValue: boolean;
  preview: string;
  source: 'db' | 'env' | 'unset';
}
export interface IntegrationGroup {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  fields: IntegrationField[];
}

// ---- Assistant ----
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
export interface AssistantChatResponse {
  reply: string;
  fallback: boolean;
}
export const assistantApi = {
  createLead: (body: unknown) =>
    api.post<{ id: string }>('/assistant/leads', body),
  recordInteraction: (body: unknown) =>
    api.post<void>('/assistant/interactions', body),
  chat: (messages: ChatMessage[]) =>
    api.post<AssistantChatResponse>('/assistant/chat', { messages }),
};
