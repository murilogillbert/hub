import { z } from 'zod';

export const markDriverRewardPaidSchema = z.object({
  source: z.enum(['DriverCommission', 'SurveyReward']),
  // Se omitido, paga o saldo devedor inteiro daquela fonte (zera).
  amount: z.number().positive().optional(),
  note: z.string().max(400).optional(),
});
export type MarkDriverRewardPaidRequest = z.infer<typeof markDriverRewardPaidSchema>;

export interface DriverRewardSummaryDto {
  driverId: string;
  driverName: string;
  driverEmail: string;
  commissionEarned: number;
  commissionPaid: number;
  commissionOwed: number;
  surveyEarned: number;
  surveyPaid: number;
  surveyOwed: number;
}

export interface DriverRewardPayoutDto {
  id: string;
  driverId: string;
  driverName: string;
  source: 'DriverCommission' | 'SurveyReward';
  amount: number;
  note: string;
  createdAt: Date;
}
