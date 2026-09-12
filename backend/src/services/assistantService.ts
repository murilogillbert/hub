import type {
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantLeadDto,
  AssistantLeadInput,
  BotInteractionInput,
  LucroSubmissionDto,
  LucroSubmissionInput,
} from '../dtos/assistant.dto.js';
import { AppError } from '../errors.js';
import { getSetting } from '../infra/settingsProvider.js';
import { prisma } from '../infra/prisma.js';

const SYSTEM_PROMPT = `Você é o assistente virtual do OpenDriverHub, um marketplace onde parceiros
(cafeterias, restaurantes, cinemas, cursos) vendem produtos, vouchers e
serviços para clientes cadastrados, e TODA compra gera cashback que vira
crédito para abater na próxima compra.

Seu objetivo é CONVERTER: entender rápido a necessidade do visitante,
recomendar a categoria/benefício certo e conduzi-lo a (1) criar conta e
comprar no catálogo, ou (2) continuar o atendimento no WhatsApp.

Regras:
- Responda em português do Brasil, tom amigável e direto.
- Mensagens curtas (no máximo 3 frases). Faça UMA pergunta por vez.
- Destaque o cashback e o preço menor como motivadores.
- Categorias reais: Alimentação, Cafeteria, Entretenimento, Educação.
- Não invente produtos, preços ou promoções específicas.
- Quando perceber intenção de compra ou dúvida que exige humano,
  incentive: "posso te encaminhar para o WhatsApp para finalizar".
- Nunca peça dados sensíveis (senha, cartão).`;

function parseTemp(s: string): 'Quente' | 'Morno' | 'Frio' {
  const v = s.toLowerCase();
  if (v === 'quente') return 'Quente';
  if (v === 'morno') return 'Morno';
  return 'Frio';
}

export async function chat(req: AssistantChatRequest, userId: string | null): Promise<AssistantChatResponse> {
  const apiKey = await getSetting('Groq:ApiKey');
  const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  if (!apiKey) {
    // Sem chave configurada → sinaliza fallback (front usa o motor local).
    return { reply: '', fallback: true };
  }

  const model = (await getSetting('Groq:Model')) ?? 'llama-3.3-70b-versatile';

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...req.messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];

  let reply: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 320 }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!resp.ok) return { reply: '', fallback: true };
    const json = (await resp.json()) as any;
    reply = json?.choices?.[0]?.message?.content ?? '';
    if (!reply.trim()) return { reply: '', fallback: true };
  } catch {
    return { reply: '', fallback: true };
  }

  // Persiste a interação para o painel de leads do admin.
  await prisma.botInteraction.create({
    data: { userMessage: lastUser, botResponse: reply, step: 'llm' },
  });

  return { reply: reply.trim(), fallback: false };
}

export async function createLead(userId: string | null, input: AssistantLeadInput): Promise<AssistantLeadDto> {
  const lead = await prisma.assistantLead.create({
    data: {
      userId,
      profile: input.profile,
      category: input.category,
      goal: input.goal,
      mainIntent: input.mainIntent,
      score: input.score,
      temperature: parseTemp(input.temperature),
    },
  });
  return { id: lead.id, lead: input, createdAt: lead.createdAt };
}

export async function recordInteraction(input: BotInteractionInput): Promise<void> {
  await prisma.botInteraction.create({
    data: {
      leadId: input.leadId ?? undefined,
      userMessage: input.mensagemUsuario,
      botResponse: input.respostaBot,
      step: input.etapaFluxo,
    },
  });
}

export async function createLucroSubmission(
  userId: string | null,
  ip: string | null,
  input: LucroSubmissionInput,
): Promise<LucroSubmissionDto> {
  if (!input.consent.granted) throw new AppError('Consentimento LGPD é obrigatório para gravar os dados.', 400);

  // 1. Lead mínimo (entra no ranking de temperatura do admin).
  const lead = await prisma.assistantLead.create({
    data: {
      userId,
      profile: 'motorista',
      category: 'lucro_real',
      goal: 'auto_diagnostico',
      mainIntent: 'descobrir_se_compensa',
      score: input.score,
      temperature: parseTemp(input.temperature),
    },
  });

  // 2. Trilha de auditoria LGPD: consentimento + payload completo, com
  //    timestamp e IP. PII fica numa única linha indexável por leadId.
  const payload = JSON.stringify({
    contact: input.contact,
    consent: {
      granted: input.consent.granted,
      text: input.consent.consentText,
      version: input.consent.consentVersion,
      grantedAt: new Date().toISOString(),
      ip,
    },
    input: input.input,
    result: input.result,
  });

  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: 'lucro_real_submitted',
      entityType: 'DriverProfit',
      entityId: lead.id,
      payloadJson: payload,
    },
  });

  return { id: lead.id, createdAt: lead.createdAt };
}

export async function listLeads(): Promise<AssistantLeadDto[]> {
  const rows = await prisma.assistantLead.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  return rows.map((l) => ({
    id: l.id,
    lead: {
      profile: l.profile ?? undefined,
      category: l.category ?? undefined,
      goal: l.goal ?? undefined,
      mainIntent: l.mainIntent ?? undefined,
      score: l.score,
      temperature: l.temperature.toLowerCase(),
    },
    createdAt: l.createdAt,
  }));
}
