/**
 * Motor de conversa local (rule-based) — portado de
 * Opendriver/apps/web/src/lib/localAssistantEngine.ts.
 *
 * Mantém a lógica de scoring/temperatura comprovada, com fluxo adaptado:
 *   profile -> category -> goal -> ready
 */

import {
  AssistantIntent,
  AssistantQuickReply,
  categoryReplies,
  fallbackPainResponse,
  goalReplies,
  intentResponses,
  profileReplies,
} from './assistantFlow';

export type AssistantStep = 'profile' | 'category' | 'goal' | 'ready';

export type LeadTemperature = 'frio' | 'morno' | 'quente';

export type AssistantLead = {
  profile?: string;
  category?: string;
  goal?: string;
  mainIntent?: AssistantIntent;
  score: number;
  temperature: LeadTemperature;
};

export type AssistantEngineState = {
  step: AssistantStep;
  lead: AssistantLead;
};

export type AssistantEngineResult = AssistantEngineState & {
  responses: string[];
  quickReplies: AssistantQuickReply[];
};

const intentKeywords: Record<Exclude<AssistantIntent, 'unknown'>, string[]> = {
  cashback: ['cashback', 'volta', 'credito', 'crédito', 'acumular'],
  economia: ['barato', 'economizar', 'economia', 'desconto', 'preco', 'preço'],
  praticidade: ['pratico', 'prático', 'rapido', 'rápido', 'qr', 'facil', 'fácil'],
  exclusivo: ['exclusivo', 'unico', 'único', 'combo', 'voucher'],
  parceiro: ['parceiro', 'vender', 'venda', 'loja', 'comissao', 'comissão'],
  suporte: ['suporte', 'atendimento', 'ajuda', 'duvida', 'dúvida', 'humano'],
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export function createInitialAssistantState(): AssistantEngineState {
  return { step: 'profile', lead: { score: 0, temperature: 'frio' } };
}

export function getQuickRepliesForStep(
  step: AssistantStep,
): AssistantQuickReply[] {
  if (step === 'profile') return profileReplies;
  if (step === 'category') return categoryReplies;
  if (step === 'goal') return goalReplies;
  return [];
}

export function detectIntent(input: string): AssistantIntent {
  const text = normalize(input);
  const match = Object.entries(intentKeywords).find(([, keywords]) =>
    keywords.some((keyword) => text.includes(normalize(keyword))),
  );
  return (match?.[0] as AssistantIntent | undefined) ?? 'unknown';
}

function getTemperature(score: number): LeadTemperature {
  if (score >= 6) return 'quente';
  if (score >= 3) return 'morno';
  return 'frio';
}

function buildReadyResponse(lead: AssistantLead) {
  const category = lead.category ? ` em ${lead.category}` : '';
  const interest =
    lead.mainIntent && lead.mainIntent !== 'unknown'
      ? intentResponses[lead.mainIntent].label
      : 'benefícios do hub';
  return `Pelo que você contou, faz sentido focar em ${interest}${category}. Já preparei um resumo para o atendimento continuar no WhatsApp.`;
}

export function advanceAssistant(
  state: AssistantEngineState,
  userInput: string,
): AssistantEngineResult {
  const input = userInput.trim();

  if (state.step === 'profile') {
    const isParceiro = normalize(input).includes('parceiro');
    const score = state.lead.score + (isParceiro ? 2 : 1);
    const lead = {
      ...state.lead,
      profile: input,
      mainIntent: isParceiro ? ('parceiro' as AssistantIntent) : undefined,
      score,
      temperature: getTemperature(score),
    };
    return {
      step: 'category',
      lead,
      responses: [
        'Perfeito, já ajuda a personalizar.',
        'Qual categoria mais te interessa hoje?',
      ],
      quickReplies: getQuickRepliesForStep('category'),
    };
  }

  if (state.step === 'category') {
    const score = state.lead.score + 1;
    const lead = {
      ...state.lead,
      category: input,
      score,
      temperature: getTemperature(score),
    };
    return {
      step: 'goal',
      lead,
      responses: [
        'Anotado.',
        'Última pergunta: o que mais te atrai no OpenDriverHub?',
      ],
      quickReplies: getQuickRepliesForStep('goal'),
    };
  }

  if (state.step === 'goal') {
    const intent = state.lead.mainIntent
      ? state.lead.mainIntent
      : detectIntent(input);
    const matched =
      intent !== 'unknown' ? intentResponses[intent] : undefined;
    const score = state.lead.score + (matched?.score ?? 1);
    const lead = {
      ...state.lead,
      goal: input,
      mainIntent: intent,
      score,
      temperature: getTemperature(score),
    };
    return {
      step: 'ready',
      lead,
      responses: [
        matched?.response ?? fallbackPainResponse,
        buildReadyResponse(lead),
      ],
      quickReplies: [],
    };
  }

  return {
    ...state,
    responses: [
      'Já tenho o essencial. É só continuar pelo WhatsApp com o resumo pronto.',
    ],
    quickReplies: [],
  };
}

export function getLeadInterestLabel(lead: AssistantLead) {
  if (!lead.mainIntent || lead.mainIntent === 'unknown') {
    return 'benefícios do hub';
  }
  return intentResponses[lead.mainIntent].summary;
}
