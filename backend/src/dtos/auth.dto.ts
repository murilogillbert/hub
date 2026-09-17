import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  cpf: z.string().optional(),
  phone: z.string().optional(),
});
export type RegisterRequest = z.infer<typeof registerSchema>;

export const partnerRegisterSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  storeName: z.string().min(1),
  segment: z.string().min(1),
  // Se true, `segment` não é um nome de categoria existente e sim um texto
  // livre sugerido pelo usuário (opção "Outro") — vira uma CategorySuggestion
  // pendente de avaliação do Admin.
  segmentIsSuggestion: z.boolean().optional().default(false),
  cnpj: z.string().optional(),
  documentType: z.enum(['CPF', 'CNPJ']).default('CNPJ'),
  city: z.string().optional(),
  state: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});
export type PartnerRegisterRequest = z.infer<typeof partnerRegisterSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  cpf: z.string().optional(),
  avatarUrl: z.string().optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;

export const updateNotificationsSchema = z.object({
  whatsApp: z.boolean(),
  email: z.boolean(),
  promo: z.boolean(),
});
export type UpdateNotificationsRequest = z.infer<typeof updateNotificationsSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});
export type ResendVerificationRequest = z.infer<typeof resendVerificationSchema>;

export const confirmVerificationSchema = z.object({
  token: z.string().min(10),
});
export type ConfirmVerificationRequest = z.infer<typeof confirmVerificationSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(6),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordSchema>;

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: string;
  cashbackBalance: number;
  avatarUrl: string | null;
  partnerId: string | null;
  phone: string | null;
  cpf: string | null;
  emailVerifiedAt: Date | null;
  notifyWhatsApp: boolean;
  notifyEmail: boolean;
  notifyPromo: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: UserDto;
}

export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  channel: string;
  read: boolean;
  createdAt: Date;
}

const roleEnum = z.enum([
  'client',
  'partner',
  'admin',
  'financeiro',
  'Client',
  'Partner',
  'Admin',
  'Financeiro',
]);

export const adminUserCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  role: roleEnum,
  cashbackBalance: z.number(),
  partnerId: z.string().uuid().optional().nullable(),
});
export type AdminUserCreateRequest = z.infer<typeof adminUserCreateSchema>;

export const adminUserUpdateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: roleEnum,
  cashbackBalance: z.number(),
  partnerId: z.string().uuid().optional().nullable(),
});
export type AdminUserUpdateRequest = z.infer<typeof adminUserUpdateSchema>;
