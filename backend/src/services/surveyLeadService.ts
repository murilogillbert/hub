import type { Prisma } from '@prisma/client';
import { toPage, type PagedResult } from '../dtos/common.dto.js';
import type { SurveyLeadDto } from '../dtos/survey.dto.js';
import { getSetting } from '../infra/settingsProvider.js';
import { prisma } from '../infra/prisma.js';
import * as surveyWhatsappService from './surveyWhatsappService.js';

// IDs reais das perguntas/hidden fields da survey "Cartão de Pesquisa"
// (cmubzcey1000p01qsyb2zb98l) em forms.aazenergiasolar.com.br — conferidos
// direto no HTML da survey. Se a survey mudar (nova pergunta, pergunta
// removida), reconferir do mesmo jeito ou via GET
// /api/v1/management/surveys/{surveyId} com a API key de gerenciamento.
const QUESTION_NAME = 'yt0trokhgli0ae8mb9w6322d';
const QUESTION_PHONE = 'm6njcxptzcst1zbe1pk51snd';
const QUESTION_HAS_CANDIDATE = 'foxsoaxxu9cs4dyuvll5bnv4';
const HIDDEN_FIELD_DRIVER_CODE = 'motoristaCode';

const DEFAULT_REWARD_AMOUNT = 4;

interface FormbricksWebhookBody {
  data?: {
    id?: string;
    data?: Record<string, unknown>;
  };
}

/** A pergunta "Possui Deputado Federal?" está com o widget de múltipla
 * escolha (checkbox) — o webhook manda a(s) label(s) selecionada(s), como
 * string ou array de strings conforme o tipo exato da pergunta. Aceita os
 * dois formatos e casa por prefixo "não/nao" (label) ou pelo id da opção. */
function isNegativeAnswer(value: unknown): boolean {
  const candidates = Array.isArray(value) ? value : [value];
  return candidates.some((v) => {
    if (typeof v !== 'string') return false;
    const s = v.trim().toLowerCase();
    return s.startsWith('não') || s.startsWith('nao') || s === 'no' || s === 'jpfrwhi9z7nrkda1mpwshb12';
  });
}

function normalizePhone(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** Processa uma resposta do Formbricks: conta a resposta pro motorista de
 * origem e, se a pessoa respondeu "sem candidato", captura o lead. O mesmo
 * telefone só gera pagamento uma vez — reenvios/duplicatas ficam registrados
 * (pra auditoria) mas com rewarded=false. Não bloqueia no envio do
 * WhatsApp — falha só marca o status, não impede o pagamento já feito. */
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
  const phone = normalizePhone(answers[QUESTION_PHONE]);
  if (!name || !phone) return;

  const existingByReference = await prisma.surveyLead.findUnique({ where: { externalReference } });
  if (existingByReference) return; // webhook repetido, já processado

  const alreadySeenPhone = await prisma.surveyLead.findFirst({ where: { phone } });
  const rewardAmount = Number((await getSetting('Survey:RewardAmount')) ?? DEFAULT_REWARD_AMOUNT);

  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.surveyLead.create({
      data: {
        driverId: driver?.id ?? null,
        externalReference,
        name,
        phone,
        rewarded: !alreadySeenPhone && !!driver,
        rewardAmount: !alreadySeenPhone && driver ? rewardAmount : null,
      },
    });

    if (!alreadySeenPhone && driver) {
      await addSurveyReward(tx, driver.id, rewardAmount, name);
    }

    return created;
  });

  const sent = await surveyWhatsappService.sendVideoMessage(phone, name);
  await prisma.surveyLead.update({
    where: { id: lead.id },
    data: { whatsappStatus: sent ? 'Sent' : 'Failed', whatsappSentAt: sent ? new Date() : null },
  });
}

async function addSurveyReward(
  tx: Prisma.TransactionClient,
  driverId: string,
  amount: number,
  leadName: string,
): Promise<void> {
  await tx.cashbackEntry.create({
    data: {
      userId: driverId,
      type: 'Earned',
      amount,
      description: `Pesquisa de opinião — indicação de ${leadName}`,
    },
  });
  await tx.user.update({
    where: { id: driverId },
    data: {
      cashbackBalance: { increment: amount },
      surveyLinkLeads: { increment: 1 },
    },
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
    rewarded: r.rewarded,
    rewardAmount: r.rewardAmount ? Number(r.rewardAmount) : null,
    whatsappStatus: r.whatsappStatus,
    whatsappSentAt: r.whatsappSentAt,
    createdAt: r.createdAt,
  }));
  return toPage(items, total, page, pageSize);
}

export interface SurveySummary {
  totalLeads: number;
  rewardedLeads: number;
  totalPaid: number;
  topDrivers: { driverId: string; driverName: string; leads: number; paid: number }[];
}

export async function summary(): Promise<SurveySummary> {
  const [totalLeads, rewardedLeads, paidAgg, grouped] = await Promise.all([
    prisma.surveyLead.count(),
    prisma.surveyLead.count({ where: { rewarded: true } }),
    prisma.surveyLead.aggregate({ where: { rewarded: true }, _sum: { rewardAmount: true } }),
    prisma.surveyLead.groupBy({
      by: ['driverId'],
      where: { rewarded: true, driverId: { not: null } },
      _count: { _all: true },
      _sum: { rewardAmount: true },
      orderBy: { _count: { driverId: 'desc' } },
      take: 10,
    }),
  ]);

  const driverIds = grouped.map((g) => g.driverId).filter((id): id is string => !!id);
  const drivers = driverIds.length
    ? await prisma.user.findMany({ where: { id: { in: driverIds } } })
    : [];
  const nameById = new Map(drivers.map((d) => [d.id, d.name]));

  return {
    totalLeads,
    rewardedLeads,
    totalPaid: Number(paidAgg._sum.rewardAmount ?? 0),
    topDrivers: grouped.map((g) => ({
      driverId: g.driverId as string,
      driverName: nameById.get(g.driverId as string) ?? '—',
      leads: g._count._all,
      paid: Number(g._sum.rewardAmount ?? 0),
    })),
  };
}
