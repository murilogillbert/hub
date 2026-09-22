// ---------- Pesquisa de opinião (link pessoal do motorista) ----------

export interface SurveyLinkDto {
  code: string;
  views: number;
  responses: number;
  leads: number;
}

export interface SurveyLeadDto {
  id: string;
  driverId: string | null;
  driverName: string | null;
  name: string;
  phone: string;
  rewarded: boolean;
  rewardAmount: number | null;
  whatsappStatus: string;
  whatsappSentAt: Date | null;
  videosSent: number;
  videosTotal: number;
  createdAt: Date;
}

// WhatsApp central da pesquisa (mesmas formas do WhatsApp por-afiliado em
// affiliate.dto.ts — reaproveitadas em vez de duplicadas, ver survey.routes.ts).
export type { WhatsAppConnectDto, WhatsAppStatusDto } from './affiliate.dto.js';
