import { z } from 'zod';

export const pixKeyTypeSchema = z.enum(['CPF', 'CNPJ', 'Email', 'Phone', 'Random']);

// ---------- Inscrição pública "quero ser afiliado" ----------
export const affiliateApplicationSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().default(''),
  city: z.string().default(''),
  state: z.string().default(''),
  message: z.string().default(''),
});
export type AffiliateApplicationInput = z.infer<typeof affiliateApplicationSchema>;

export interface AffiliateApplicationDto {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  message: string;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
}

export const resolveApplicationSchema = z.object({
  feePercent: z.number().min(0).max(100).optional(),
});
export type ResolveApplicationRequest = z.infer<typeof resolveApplicationSchema>;

// ---------- Carteira / extrato ----------
export interface AffiliatePartnerDto {
  id: string;
  name: string;
  kind: string;
  referralCode: string | null;
  commissionBalance: number;
  linkViews: number;
  linkLeads: number;
  linkSales: number;
  active: boolean;
  ownedByCompany: boolean;
  pixKey: string | null;
  pixKeyType: string | null;
  // Dados de perfil/loja (autoatendimento — ver PUT /partner/profile).
  segment: string;
  logoUrl: string;
  cnpj: string;
  documentType: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  evolutionInstance: string | null;
}

export const updatePixKeySchema = z.object({
  pixKey: z.string().min(1),
  pixKeyType: pixKeyTypeSchema,
});
export type UpdatePixKeyRequest = z.infer<typeof updatePixKeySchema>;

export interface CommissionEntryDto {
  id: string;
  partnerId: string;
  type: string;
  amount: number;
  description: string;
  externalReference: string | null;
  createdAt: Date;
}

// ---------- Saque ----------
export const requestWithdrawalSchema = z.object({
  amount: z.number().positive(),
  note: z.string().optional(),
  // Se ausente, usa a chave Pix salva no perfil do afiliado (Partner.pixKey).
  pixKey: z.string().optional(),
  pixKeyType: pixKeyTypeSchema.optional(),
});
export type RequestWithdrawalRequest = z.infer<typeof requestWithdrawalSchema>;

export const resolveWithdrawalSchema = z.object({
  note: z.string().optional(),
});
export type ResolveWithdrawalRequest = z.infer<typeof resolveWithdrawalSchema>;

export interface WithdrawalRequestDto {
  id: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  status: string;
  note: string;
  pixKey: string | null;
  pixKeyType: string | null;
  requestedAt: Date;
  resolvedAt: Date | null;
}

export const adjustBalanceSchema = z.object({
  type: z.enum(['credit', 'debit']),
  amount: z.number().positive(),
  description: z.string().min(1),
});
export type AdjustBalanceRequest = z.infer<typeof adjustBalanceSchema>;

// ---------- Materiais de campanha ----------
export const campaignMaterialSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  fileUrl: z.string().min(1),
  active: z.boolean().default(true),
});
export type CampaignMaterialRequest = z.infer<typeof campaignMaterialSchema>;

export interface CampaignMaterialDto {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  active: boolean;
  createdAt: Date;
}

// ---------- Chaves de API de serviço ----------
export const createApiKeySchema = z.object({
  label: z.string().min(1),
  // `account:*` é usado na exclusão de conta entre os serviços do ecossistema
  // (docs/normalizacao-banco.md) — hoje OpenDriver e OpenAd. `ads:*` é do OpenAd:
  // `ads:earning:write` autoriza o OpenAd a creditar repasse de anúncio em
  // `opendriver.driver_earnings`, `ads:payout:read` permite conferir o total devido, e
  // `ads:credit:*` cobre a compra de crédito de veiculação por Pix.
  //
  // Enum fechado de propósito: escopo só existe se estiver aqui. Uma chave pedida com escopo
  // fora da lista é recusada na criação, não descoberta em produção como 403 silencioso.
  scopes: z
    .array(
      z.enum([
        'affiliate:read',
        'affiliate:write',
        'account:read',
        'account:purge',
        'ads:earning:write',
        'ads:payout:read',
        // Crédito de veiculação, nos dois sentidos: `charge` autoriza o OpenAd a pedir ao hub
        // uma cobrança Pix (a conta do Asaas é do hub), e `write` autoriza o hub a confirmar,
        // estornar ou lançar crédito no livro-caixa do OpenAd quando o pagamento se resolve.
        // Dois escopos e não um porque as direções têm consequências diferentes: pedir cobrança
        // não move saldo, lançar crédito move.
        'ads:credit:charge',
        'ads:credit:write',
      ])
    )
    .min(1),
});
export type CreateApiKeyRequest = z.infer<typeof createApiKeySchema>;

export interface ServiceApiKeyDto {
  id: string;
  label: string;
  keyPreview: string;
  scopes: string[];
  active: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

// ---------- API de serviço (energia-solar-api, n8n, ...) ----------
export const linkEventSchema = z.object({
  type: z.enum(['lead', 'sale']),
});
export type LinkEventRequest = z.infer<typeof linkEventSchema>;

// ---------- WhatsApp self-service (Evolution API) ----------
export interface WhatsAppConnectDto {
  status: 'connected' | 'qrcode';
  qrCodeBase64?: string;
}

export interface WhatsAppStatusDto {
  status: 'connected' | 'connecting' | 'disconnected';
}

export interface AffiliateLookupDto {
  code: string;
  name: string;
  active: boolean;
  whatsappPhone: string | null;
  // Instância do afiliado no Evolution API — pro energia-solar-api saber de
  // qual WhatsApp mandar a proposta em PDF.
  evolutionInstance: string | null;
}
