import type { NamedValue, SeriesPoint } from './common.dto.js';

export interface PartnerMetricsDto {
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
