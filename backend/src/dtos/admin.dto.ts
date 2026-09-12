import { z } from 'zod';
import type { NamedValue, SeriesPoint } from './common.dto.js';

export interface TopPartner {
  partnerId: string;
  partnerName: string;
  revenue: number;
}

export interface AdminMetricsDto {
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

export interface AuditLogDto {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payloadJson: string | null;
  createdAt: Date;
}

export interface PartnerPayoutDto {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  periodStart: Date;
  periodEnd: Date;
  note: string;
  createdAt: Date;
}

export interface PartnerPayoutSummaryDto {
  partnerId: string;
  partnerName: string;
  earnedNet: number;
  paid: number;
  available: number;
}

export const createPayoutSchema = z.object({
  partnerId: z.string().uuid(),
  amount: z.number().positive(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  note: z.string().optional(),
});
export type CreatePayoutRequest = z.infer<typeof createPayoutSchema>;
