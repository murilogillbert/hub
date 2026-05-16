/** Portado de Opendriver/apps/web/src/lib/whatsapp.ts */
import { AssistantLead, getLeadInterestLabel } from './localAssistantEngine';

const WHATSAPP_NUMBER = '556182187476';

export function createWhatsAppLeadUrl(lead: AssistantLead): string {
  const lines = [
    'Olá, vim pelo assistente do OpenDriverHub.',
    lead.profile ? `Perfil: ${lead.profile}` : undefined,
    lead.category ? `Categoria de interesse: ${lead.category}` : undefined,
    `Principal interesse: ${getLeadInterestLabel(lead)}`,
    `Temperatura do lead: ${lead.temperature}`,
    'Quero saber como aproveitar os benefícios e o cashback.',
  ].filter(Boolean);

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    lines.join('\n'),
  )}`;
}
