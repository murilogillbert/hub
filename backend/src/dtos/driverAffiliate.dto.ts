import { z } from 'zod';

export const addDriverAffiliateSchema = z.object({
  driverId: z.string().uuid(),
  commissionPercent: z.number().min(0).max(100),
});
export type AddDriverAffiliateRequest = z.infer<typeof addDriverAffiliateSchema>;

export const updateDriverAffiliateSchema = z.object({
  commissionPercent: z.number().min(0).max(100),
});
export type UpdateDriverAffiliateRequest = z.infer<typeof updateDriverAffiliateSchema>;

export const bulkCommissionSchema = z.object({
  commissionPercent: z.number().min(0).max(100),
});
export type BulkCommissionRequest = z.infer<typeof bulkCommissionSchema>;

export interface DriverSearchResultDto {
  id: string;
  name: string;
  email: string;
  alreadyAffiliated: boolean;
}

export interface DriverAffiliateDto {
  id: string;
  driverId: string;
  driverName: string;
  driverEmail: string;
  commissionPercent: number;
  linkViews: number;
  commissionEarned: number;
  ordersCount: number;
  createdAt: Date;
}

export interface MyAffiliationDto {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerLogoUrl: string;
  commissionPercent: number;
  linkViews: number;
  commissionEarned: number;
}

export interface MyAffiliateProgramDto {
  affiliateCode: string;
  stores: MyAffiliationDto[];
}

export interface StoreReferralMetricsDto {
  ordersCount: number;
  revenue: number;
  commissionPaid: number;
  linkViews: number;
}
