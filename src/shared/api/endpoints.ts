import { api, SERVER_ORIGIN, tokenStore } from './client';
import { Product, PartnerStore, Partner, Order, User } from '@shared/types';

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
  }) => api.postPublic<AuthResponse>('/auth/register/partner', body),
  me: () => api.get<User>('/auth/me'),
  updateProfile: (body: { name: string; email: string; phone?: string }) =>
    api.put<User>('/me/profile', body),
  updateNotifications: (body: {
    whatsApp: boolean;
    email: boolean;
    promo: boolean;
  }) => api.put<void>('/me/notifications', body),
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
  create: (productId: string, useCashback = false) =>
    api.post<Order>('/orders', { productId, useCashback }),
  myOrders: (status?: string) =>
    api.get<Order[]>(`/me/orders${status ? `?status=${status}` : ''}`),
  myOrder: (id: string) => api.get<Order>(`/me/orders/${id}`),
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
  redeem: (code: string, confirm: boolean) =>
    api.post<RedeemResult>(
      `/partner/redeem?confirm=${confirm}`,
      { code },
    ),
};

// ---- Admin ----
export const adminApi = {
  metrics: () => api.get<AdminMetrics>('/admin/metrics'),
  sales: (params?: { partnerId?: string; status?: string; q?: string }) => {
    const qs = new URLSearchParams();
    if (params?.partnerId) qs.set('partnerId', params.partnerId);
    if (params?.status) qs.set('status', params.status);
    if (params?.q) qs.set('q', params.q);
    const s = qs.toString();
    return api.get<Order[]>(`/admin/sales${s ? `?${s}` : ''}`);
  },
  partners: () => api.get<Partner[]>('/admin/partners'),
  createPartner: (body: {
    name: string;
    segment: string;
    logoUrl: string;
    feePercent: number;
    active: boolean;
  }) => api.post<Partner>('/admin/partners', body),
  updatePartner: (
    id: string,
    body: {
      name: string;
      segment: string;
      logoUrl: string;
      feePercent: number;
      active: boolean;
    },
  ) => api.put<Partner>(`/admin/partners/${id}`, body),
  deletePartner: (id: string) => api.del<void>(`/admin/partners/${id}`),
  users: (q?: string) =>
    api.get<User[]>(`/admin/users${q ? `?q=${q}` : ''}`),
  leads: () => api.get<LeadDto[]>('/admin/leads'),
  integrations: () => api.get<IntegrationGroup[]>('/admin/integrations'),
  updateIntegration: (key: string, value: string | null) =>
    api.put<IntegrationGroup[]>('/admin/integrations', { key, value }),
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
