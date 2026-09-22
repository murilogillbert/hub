import { toPage, type PagedResult } from '../dtos/common.dto.js';
import type { SurveyLeadDto } from '../dtos/survey.dto.js';
import { prisma } from '../infra/prisma.js';
import * as surveyWhatsappService from './surveyWhatsappService.js';

// IDs reais das perguntas/hidden fields da survey no Formbricks — placeholders
// até a survey existir. Atualizar assim que tiver o link dela (mesmo
// processo da pesquisa solar: GET /api/v1/management/surveys/{surveyId} com
// a API key de gerenciamento do Formbricks).
const QUESTION_HAS_CANDIDATE = 'hasCandidate';
const QUESTION_NAME = 'leadName';
const QUESTION_PHONE = 'leadPhone';
const HIDDEN_FIELD_DRIVER_CODE = 'motoristaCode';

interface FormbricksWebhookBody {
  data?: {
    id?: string;
    data?: Record<string, unknown>;
  };
}

function isNegativeAnswer(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const v = value.trim().toLowerCase();
  return v.startsWith('não') || v.startsWith('nao') || v === 'no';
}

/** Processa uma resposta do Formbricks: conta a resposta pro motorista de
 * origem e, se a pessoa respondeu "sem candidato", captura o lead e dispara
 * o WhatsApp com o vídeo (não bloqueia — falha de envio só marca o status). */
export async function handleFormbricksWebhook(body: FormbricksWebhookBody): Promise<void> {
  const answers = body.data?.data ?? {};
  const externalReference = body.data?.id;
  if (!externalReference) return;

  const driverCode = answers[HIDDEN_FIELD_DRIVER_CODE];
  const driver =
    typeof driverCode === 'string' && driverCode
      ? await prisma.user.findUnique({ where: { surveyCode: driverCode } })
      : null;

  if (driver) {
    await prisma.user.update({
      where: { id: driver.id },
      data: { surveyLinkResponses: { increment: 1 } },
    });
  }

  if (!isNegativeAnswer(answers[QUESTION_HAS_CANDIDATE])) return;

  const name = String(answers[QUESTION_NAME] ?? '').trim();
  const phone = String(answers[QUESTION_PHONE] ?? '').trim();
  if (!name || !phone) return;

  const existing = await prisma.surveyLead.findUnique({ where: { externalReference } });
  if (existing) return;

  const lead = await prisma.surveyLead.create({
    data: { driverId: driver?.id ?? null, externalReference, name, phone },
  });

  if (driver) {
    await prisma.user.update({
      where: { id: driver.id },
      data: { surveyLinkLeads: { increment: 1 } },
    });
  }

  const sent = await surveyWhatsappService.sendVideoMessage(phone, name);
  await prisma.surveyLead.update({
    where: { id: lead.id },
    data: { whatsappStatus: sent ? 'Sent' : 'Failed', whatsappSentAt: sent ? new Date() : null },
  });
}

export async function listLeads(page: number, pageSize: number): Promise<PagedResult<SurveyLeadDto>> {
  const skip = (page - 1) * pageSize;
  const [rows, total] = await Promise.all([
    prisma.surveyLead.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: { driver: true },
    }),
    prisma.surveyLead.count(),
  ]);
  const items: SurveyLeadDto[] = rows.map((r) => ({
    id: r.id,
    driverId: r.driverId,
    driverName: r.driver?.name ?? null,
    name: r.name,
    phone: r.phone,
    whatsappStatus: r.whatsappStatus,
    whatsappSentAt: r.whatsappSentAt,
    createdAt: r.createdAt,
  }));
  return toPage(items, total, page, pageSize);
}
