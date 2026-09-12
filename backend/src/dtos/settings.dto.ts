import { z } from 'zod';

export interface IntegrationFieldDto {
  key: string;
  label: string;
  secret: boolean;
  hasValue: boolean;
  preview: string;
  source: 'db' | 'env' | 'unset';
}

export interface IntegrationGroupDto {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  fields: IntegrationFieldDto[];
}

export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string().optional().nullable(),
});
export type UpdateSettingRequest = z.infer<typeof updateSettingSchema>;
