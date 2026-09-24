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
  driverReferral: {
    ordersCount: number;
    revenue: number;
    commissionPaid: number;
    linkViews: number;
  };
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
    role: 'Passenger' | 'Driver';
  }) => api.postPublic<AuthResponse>('/auth/register', body),
  registerPartner: (body: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    storeName: string;
    segment: string;
    segmentIsSuggestion?: boolean;
    cnpj?: string;
    documentType?: 'CPF' | 'CNPJ';
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
    cpf?: string;
    avatarUrl?: string;
  }) => api.put<User>('/me/profile', body),
  updateNotifications: (body: {
    whatsApp: boolean;
    email: boolean;
    promo: boolean;
  }) => api.put<void>('/me/notifications', body),
  notifications: () => api.get<AppNotification[]>('/me/notifications'),
  markNotificationsRead: () => api.post<void>('/me/notifications/read', {}),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.put<void>('/me/password', body),
  resendVerification: (email: string) =>
    api.postPublic<{ message: string }>('/auth/verify-email/resend', { email }),
  confirmEmailVerification: (token: string) =>
    api.postPublic<{ message: string }>('/auth/verify-email/confirm', { token }),
  forgotPassword: (email: string) =>
    api.postPublic<{ message: string }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.postPublic<{ message: string }>('/auth/reset-password', { token, newPassword }),
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
    affiliateCode?: string,
  ) => api.post<Order>('/orders', { items, useCashback, affiliateCode: affiliateCode || undefined }),
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
    card?: {
      number: string;
      holder: string;
      expiry: string;
      cvv: string;
      postalCode?: string;
      addressNumber?: string;
    } | null;
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
  updateProfile: (body: UpdateMyPartnerProfile) =>
    api.put<AffiliatePartner>('/partner/profile', body),
};

// ---- Afiliação loja↔motorista (programa novo, independente do solar) ----
export interface DriverSearchResult {
  id: string;
  name: string;
  alreadyAffiliated: boolean;
}
export interface DriverAffiliate {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  commissionPercent: number;
  linkViews: number;
  commissionEarned: number;
  ordersCount: number;
  createdAt: string;
}
export interface StoreReferralMetrics {
  ordersCount: number;
  revenue: number;
  commissionPaid: number;
  linkViews: number;
}
export interface MyAffiliation {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerLogoUrl: string;
  commissionPercent: number;
  linkViews: number;
  commissionEarned: number;
}
export interface MyAffiliateProgram {
  affiliateCode: string;
  stores: MyAffiliation[];
}
export const driverAffiliateApi = {
  // Lado loja
  search: (q: string) => api.get<DriverSearchResult[]>(`/partner/affiliate-drivers/search?q=${encodeURIComponent(q)}`),
  list: () => api.get<DriverAffiliate[]>('/partner/affiliate-drivers'),
  storeMetrics: () => api.get<StoreReferralMetrics>('/partner/affiliate-drivers/metrics'),
  add: (driverId: string, commissionPercent: number) =>
    api.post<void>('/partner/affiliate-drivers', { driverId, commissionPercent }),
  update: (driverId: string, commissionPercent: number) =>
    api.put<void>(`/partner/affiliate-drivers/${driverId}`, { commissionPercent }),
  bulkSetCommission: (commissionPercent: number) =>
    api.put<void>('/partner/affiliate-drivers/bulk-commission', { commissionPercent }),
  remove: (driverId: string) => api.del<void>(`/partner/affiliate-drivers/${driverId}`),
  // Lado motorista
  myProgram: () => api.get<MyAffiliateProgram>('/me/affiliate-program'),
};

/** Autoatendimento: loja manda tudo, afiliado manda só city/state. */
export interface UpdateMyPartnerProfile {
  name?: string;
  segment?: string;
  logoUrl?: string;
  cnpj?: string;
  documentType?: 'CPF' | 'CNPJ';
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
}

// ---- Admin ----
export interface PartnerUpsert {
  name: string;
  segment: string;
  logoUrl: string;
  feePercent: number;
  active: boolean;
  cnpj?: string;
  documentType?: 'CPF' | 'CNPJ';
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  asaasWalletId?: string;
  evolutionInstance?: string;
}
export interface AdminUserUpdate {
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'passenger' | 'driver' | 'partner' | 'admin' | 'financeiro';
  cashbackBalance: number;
  partnerId?: string | null;
}
export interface AdminUserCreate extends AdminUserUpdate {
  password: string;
}
export interface PartnerPayout {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  note: string;
  createdAt: string;
}
export interface PayoutSummary {
  partnerId: string;
  partnerName: string;
  earnedNet: number;
  paid: number;
  available: number;
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
  payoutSummary: () =>
    api.get<PayoutSummary[]>('/admin/payouts/summary'),
  payouts: (params?: { partnerId?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.partnerId) qs.set('partnerId', params.partnerId);
    qs.set('page', String(params?.page ?? 1));
    qs.set('pageSize', String(params?.pageSize ?? 20));
    return api.get<PagedResult<PartnerPayout>>(
      `/admin/payouts?${qs.toString()}`,
    );
  },
  createPayout: (body: {
    partnerId: string;
    amount: number;
    periodStart: string;
    periodEnd: string;
    note?: string;
  }) => api.post<PartnerPayout>('/admin/payouts', body),
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
  categorySuggestions: (status?: string) =>
    api.get<CategorySuggestion[]>(
      `/admin/category-suggestions${status ? `?status=${status}` : ''}`,
    ),
  approveCategorySuggestion: (id: string) =>
    api.post<CategorySuggestion>(`/admin/category-suggestions/${id}/approve`),
  rejectCategorySuggestion: (id: string) =>
    api.post<CategorySuggestion>(`/admin/category-suggestions/${id}/reject`),

  // ---- Programa de afiliados ----
  affiliateApplications: (status?: string) =>
    api.get<AffiliateApplication[]>(
      `/admin/affiliate-applications${status ? `?status=${status}` : ''}`,
    ),
  approveAffiliateApplication: (id: string) =>
    api.post<AffiliateApplication>(`/admin/affiliate-applications/${id}/approve`),
  rejectAffiliateApplication: (id: string) =>
    api.post<AffiliateApplication>(`/admin/affiliate-applications/${id}/reject`),
  campaignMaterials: () => api.get<CampaignMaterial[]>('/admin/campaign-materials'),
  createCampaignMaterial: (body: {
    title: string;
    description?: string;
    fileUrl: string;
    active?: boolean;
  }) => api.post<CampaignMaterial>('/admin/campaign-materials', body),
  updateCampaignMaterial: (
    id: string,
    body: { title: string; description?: string; fileUrl: string; active: boolean },
  ) => api.put<CampaignMaterial>(`/admin/campaign-materials/${id}`, body),
  deleteCampaignMaterial: (id: string) => api.del<void>(`/admin/campaign-materials/${id}`),
  serviceApiKeys: () => api.get<ServiceApiKey[]>('/admin/service-api-keys'),
  createServiceApiKey: (body: { label: string; scopes: string[] }) =>
    api.post<ServiceApiKey & { key: string }>('/admin/service-api-keys', body),
  revokeServiceApiKey: (id: string) => api.del<void>(`/admin/service-api-keys/${id}`),

  // ---- Pesquisa de opinião ----
  surveySummary: () => api.get<SurveySummary>('/admin/survey/summary'),
  surveyLeads: (params?: { page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    qs.set('page', String(params?.page ?? 1));
    qs.set('pageSize', String(params?.pageSize ?? 20));
    return api.get<PagedResult<SurveyLead>>(`/admin/survey/leads?${qs.toString()}`);
  },
  connectSurveyWhatsapp: () => api.post<WhatsAppConnect>('/admin/survey/whatsapp'),
  surveyWhatsappStatus: () => api.get<WhatsAppStatus>('/admin/survey/whatsapp'),
  disconnectSurveyWhatsapp: () => api.del('/admin/survey/whatsapp'),
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
// Submissão da calculadora de lucro real. Endpoint dedicado para garantir
// que o contato + a trilha de consentimento LGPD sejam persistidos.
export interface LucroSubmissionPayload {
  contact: { nome?: string; whatsapp?: string; cidade?: string };
  consent: { granted: boolean; consentText: string; consentVersion: string };
  input: Record<string, number>;
  result: Record<string, unknown>;
  score: number;
  temperature: 'cold' | 'warm' | 'hot' | 'frio' | 'morno' | 'quente';
}

// ---- Programa de afiliados ----
export interface AffiliateApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string | null;
}
export type PixKeyType = 'CPF' | 'CNPJ' | 'Email' | 'Phone' | 'Random';

export interface AffiliatePartner {
  id: string;
  name: string;
  kind: 'marketplace' | 'solar_affiliate';
  referralCode: string | null;
  commissionBalance: number;
  linkViews: number;
  linkLeads: number;
  linkSales: number;
  active: boolean;
  ownedByCompany: boolean;
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  segment: string;
  logoUrl: string;
  cnpj: string;
  documentType: 'CPF' | 'CNPJ';
  city: string;
  state: string;
  lat: number;
  lng: number;
  evolutionInstance: string | null;
}

export interface CategorySuggestion {
  id: string;
  name: string;
  type: 'product' | 'store';
  status: 'pending' | 'approved' | 'rejected';
  partnerId: string | null;
  partnerName: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}
export interface CommissionEntry {
  id: string;
  partnerId: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  externalReference?: string | null;
  createdAt: string;
}
export interface WithdrawalRequest {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  note: string;
  pixKey: string | null;
  pixKeyType: PixKeyType | null;
  requestedAt: string;
  resolvedAt?: string | null;
}
export interface CampaignMaterial {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  active: boolean;
  createdAt: string;
}
export interface ServiceApiKey {
  id: string;
  label: string;
  keyPreview: string;
  scopes: string[];
  active: boolean;
  lastUsedAt?: string | null;
  createdAt: string;
}
export interface AffiliateLink {
  code: string | null;
  linkViews: number;
  linkLeads: number;
  linkSales: number;
}
export interface WhatsAppConnect {
  status: 'connected' | 'qrcode';
  qrCodeBase64?: string;
}
export interface WhatsAppStatus {
  status: 'connected' | 'connecting' | 'disconnected';
}

// ---------- Pesquisa de opinião (link pessoal do motorista) ----------
export interface SurveyLink {
  code: string;
  views: number;
  responses: number;
  leads: number;
}
export interface SurveyLead {
  id: string;
  driverId: string | null;
  driverName: string | null;
  name: string;
  phone: string;
  rewarded: boolean;
  rewardAmount: number | null;
  whatsappStatus: string;
  whatsappSentAt: string | null;
  videosSent: number;
  videosTotal: number;
  createdAt: string;
}
export interface SurveySummary {
  totalLeads: number;
  rewardedLeads: number;
  totalPaid: number;
  topDrivers: { driverId: string; driverName: string; leads: number; paid: number }[];
  leadsByDay: SeriesPoint[];
  videoStatusBreakdown: NamedValue[];
  funnel: { views: number; responses: number; leads: number; rewarded: number };
}

/** Área do motorista (Client) — link pessoal da pesquisa de opinião. */
export const surveyApi = {
  me: () => api.get<SurveyLink>('/survey/me'),
};

/** Landing "quero ser afiliado" — sem login. */
export const affiliateApplicationApi = {
  apply: (body: {
    name: string;
    email: string;
    phone?: string;
    city?: string;
    state?: string;
    message?: string;
  }) => api.postPublic<AffiliateApplication>('/affiliate-applications', body),
};

/** Área do afiliado logado (Partner.kind = solar_affiliate). */
export const affiliateApi = {
  me: () => api.get<AffiliatePartner>('/partner/me'),
  entries: () => api.get<CommissionEntry[]>('/partner/affiliate/entries'),
  withdrawals: () => api.get<WithdrawalRequest[]>('/partner/affiliate/withdrawals'),
  requestWithdrawal: (
    amount: number,
    note?: string,
    pixKey?: string,
    pixKeyType?: PixKeyType,
  ) => api.post<WithdrawalRequest>('/partner/affiliate/withdrawals', { amount, note, pixKey, pixKeyType }),
  updatePixKey: (pixKey: string, pixKeyType: PixKeyType) =>
    api.put<AffiliatePartner>('/partner/affiliate/pix-key', { pixKey, pixKeyType }),
  materials: () => api.get<CampaignMaterial[]>('/partner/affiliate/materials'),
  link: () => api.get<AffiliateLink>('/partner/affiliate/link'),
  connectWhatsApp: () => api.post<WhatsAppConnect>('/partner/affiliate/whatsapp/connect'),
  whatsappStatus: () => api.get<WhatsAppStatus>('/partner/affiliate/whatsapp/status'),
  disconnectWhatsApp: () => api.del('/partner/affiliate/whatsapp'),
};

/** Área do financeiro (role financeiro/admin). */
export const financeiroApi = {
  affiliates: () => api.get<AffiliatePartner[]>('/financeiro/affiliates'),
  affiliateEntries: (partnerId: string) =>
    api.get<CommissionEntry[]>(`/financeiro/affiliates/${partnerId}/entries`),
  adjustBalance: (
    partnerId: string,
    body: { type: 'credit' | 'debit'; amount: number; description: string },
  ) => api.post<CommissionEntry>(`/financeiro/affiliates/${partnerId}/adjust-balance`, body),
  withdrawals: (status?: string) =>
    api.get<WithdrawalRequest[]>(`/financeiro/withdrawals${status ? `?status=${status}` : ''}`),
  approveWithdrawal: (id: string, note?: string) =>
    api.post<WithdrawalRequest>(`/financeiro/withdrawals/${id}/approve`, { note }),
  rejectWithdrawal: (id: string, note?: string) =>
    api.post<WithdrawalRequest>(`/financeiro/withdrawals/${id}/reject`, { note }),
};

export const assistantApi = {
  createLead: (body: unknown) =>
    api.post<{ id: string }>('/assistant/leads', body),
  recordInteraction: (body: unknown) =>
    api.post<void>('/assistant/interactions', body),
  chat: (messages: ChatMessage[]) =>
    api.post<AssistantChatResponse>('/assistant/chat', { messages }),
  submitLucroReal: (body: LucroSubmissionPayload) =>
    api.post<{ id: string; createdAt: string }>(
      '/assistant/lucro-submissions',
      body,
    ),
};
