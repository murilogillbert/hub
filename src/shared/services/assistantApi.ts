/**
 * Tracking de leads/conversas do chatbot — agora consumindo a API .NET.
 * Mantém as assinaturas usadas pelo FloatingAssistant.
 */

import type { AssistantLead } from '@features/assistant/lib/localAssistantEngine';
import { assistantApi as api } from '@shared/api/endpoints';

export interface AssistantLeadRecord {
  id: string;
}

export interface BotInteractionInput {
  mensagemUsuario: string;
  respostaBot: string;
  etapaFluxo: string;
  leadId?: string;
  lead: AssistantLead;
}

export async function createLeadFromAssistant(
  lead: AssistantLead,
): Promise<AssistantLeadRecord> {
  const res = await api.createLead({
    profile: lead.profile,
    category: lead.category,
    goal: lead.goal,
    mainIntent: lead.mainIntent,
    score: lead.score,
    temperature: lead.temperature,
  });
  return { id: res.id };
}

export async function recordBotInteraction(
  input: BotInteractionInput,
): Promise<void> {
  await api.recordInteraction({
    mensagemUsuario: input.mensagemUsuario,
    respostaBot: input.respostaBot,
    etapaFluxo: input.etapaFluxo,
    leadId: input.leadId,
    lead: {
      profile: input.lead.profile,
      category: input.lead.category,
      goal: input.lead.goal,
      mainIntent: input.lead.mainIntent,
      score: input.lead.score,
      temperature: input.lead.temperature,
    },
  });
}
