export type UserRole = 'client' | 'partner' | 'admin' | 'guest';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cashbackBalance: number;
  avatarUrl?: string;
  phone?: string;
  partnerId?: string;
}

export type ProductKind = 'physical' | 'digital' | 'voucher';

export interface Product {
  id: string;
  partnerId: string;
  partnerName: string;
  title: string;
  description: string;
  price: number;
  cashbackPercent: number;
  kind: ProductKind;
  imageUrl: string;
  category: string;
  rating: number;
  stock: number;
}

export interface PartnerStore {
  id: string;
  partnerId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

export interface Partner {
  id: string;
  name: string;
  segment: string;
  logoUrl: string;
  active: boolean;
  feePercent: number;
  joinedAt: string;
}

export type OrderStatus = 'paid' | 'pending' | 'redeemed' | 'cancelled';

export interface Order {
  id: string;
  code: string;
  productId: string;
  productTitle: string;
  partnerId: string;
  partnerName: string;
  customerId: string;
  customerName: string;
  paidPrice: number;
  cashbackEarned: number;
  cashbackUsed: number;
  status: OrderStatus;
  createdAt: string;
  redeemedAt?: string;
}

export type PaymentMethod = 'pix' | 'credit' | 'debit';

export interface SalesByHour {
  hour: string;
  count: number;
}

export interface RevenueSeries {
  label: string;
  value: number;
}

export interface PartnerMetrics {
  totalRevenue: number;
  totalSales: number;
  pendingTransfer: number;
  paidTransfer: number;
  salesByHour: SalesByHour[];
  revenueLastDays: RevenueSeries[];
}

export interface AdminMetrics {
  gmv: number;
  netRevenue: number;
  customers: number;
  partners: number;
  ordersToday: number;
  revenueByMonth: RevenueSeries[];
  topPartners: { partnerId: string; partnerName: string; revenue: number }[];
}
