import type { Prisma } from '@prisma/client';
import { toPage, type NamedValue, type PagedResult, type SeriesPoint } from '../dtos/common.dto.js';
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

/** Só dígitos, com DDI 55 garantido — confirmado ao vivo que o Evolution
 * API rejeita como "exists:false" um número sem o código do país, e é assim
 * que a maioria das pessoas digita o próprio telefone (sem o 55 na frente). */
function normalizePhone(raw: unknown): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
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

  // Reenvio pro mesmo telefone (duplicata) não agenda uma série nova — a
  // pessoa já recebeu (ou está recebendo) os 4 vídeos da primeira vez.
  if (!alreadySeenPhone) await scheduleVideoDeliveries(lead.id);
}

/** Agenda o envio dos 4 vídeos configurados pro lead: o 1º sai quase na
 * hora (pego pelo próximo tick do job), os seguintes espaçados 28-32min um
 * do outro (aleatório dentro da faixa) — pedido explícito pra não levar
 * bloqueio do WhatsApp por mandar tudo de uma vez. */
async function scheduleVideoDeliveries(leadId: string): Promise<void> {
  const urls = await surveyWhatsappService.shuffledVideoUrls();
  if (urls.length === 0) return;

  let scheduledAt = new Date();
  const rows = urls.map((videoUrl, i) => {
    if (i > 0) {
      const minutes = 28 + Math.random() * 4; // 28–32min
      scheduledAt = new Date(scheduledAt.getTime() + minutes * 60_000);
    }
    return { leadId, videoUrl, sequence: i + 1, scheduledAt };
  });
  await prisma.surveyVideoDelivery.createMany({ data: rows });
}

/** Chamado pelo job (jobs/surveyVideoDispatch.ts) a cada tick — manda todo
 * vídeo cujo horário já chegou e ainda não foi enviado. Atualiza também
 * SurveyLead.whatsappStatus/whatsappSentAt (reflete a tentativa mais
 * recente, pra dar uma visão rápida na lista do Admin). */
export async function dispatchDueVideos(): Promise<void> {
  const due = await prisma.surveyVideoDelivery.findMany({
    where: { status: 'Pending', scheduledAt: { lte: new Date() } },
    include: { lead: true },
    take: 50,
  });

  for (const delivery of due) {
    const sent = await surveyWhatsappService.sendOne(delivery.lead.phone, delivery.lead.name, delivery.videoUrl);
    await prisma.$transaction([
      prisma.surveyVideoDelivery.update({
        where: { id: delivery.id },
        data: { status: sent ? 'Sent' : 'Failed', sentAt: sent ? new Date() : null },
      }),
      prisma.surveyLead.update({
        where: { id: delivery.leadId },
        data: { whatsappStatus: sent ? 'Sent' : 'Failed', whatsappSentAt: sent ? new Date() : null },
      }),
    ]);
  }
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
      include: { driver: true, videoDeliveries: true },
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
    videosSent: r.videoDeliveries.filter((d) => d.status === 'Sent').length,
    videosTotal: r.videoDeliveries.length,
    createdAt: r.createdAt,
  }));
  return toPage(items, total, page, pageSize);
}

export interface SurveySummary {
  totalLeads: number;
  rewardedLeads: number;
  totalPaid: number;
  topDrivers: { driverId: string; driverName: string; leads: number; paid: number }[];
  leadsByDay: SeriesPoint[];
  videoStatusBreakdown: NamedValue[];
  funnel: { views: number; responses: number; leads: number; rewarded: number };
}

const DAYS_IN_CHART = 14;

export async function summary(): Promise<SurveySummary> {
  const since = new Date();
  since.setDate(since.getDate() - (DAYS_IN_CHART - 1));
  since.setHours(0, 0, 0, 0);

  const [
    totalLeads,
    rewardedLeads,
    paidAgg,
    grouped,
    recentLeads,
    videoStatusGroups,
    viewsResponsesAgg,
  ] = await Promise.all([
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
    prisma.surveyLead.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.surveyVideoDelivery.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.aggregate({ _sum: { surveyLinkViews: true, surveyLinkResponses: true } }),
  ]);

  const driverIds = grouped.map((g) => g.driverId).filter((id): id is string => !!id);
  const drivers = driverIds.length
    ? await prisma.user.findMany({ where: { id: { in: driverIds } } })
    : [];
  const nameById = new Map(drivers.map((d) => [d.id, d.name]));

  // Preenche os 14 dias mesmo sem lead (barra zerada), pra não distorcer o
  // gráfico — mesmo espírito do byMonth em adminService.ts, só que por dia.
  const byDay = new Map<string, number>();
  for (let i = 0; i < DAYS_IN_CHART; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    byDay.set(d.toISOString().slice(0, 10), 0);
  }
  for (const lead of recentLeads) {
    const key = lead.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const leadsByDay: SeriesPoint[] = [...byDay.entries()].map(([key, value]) => ({
    label: new Date(`${key}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
    value,
  }));

  const statusLabel: Record<string, string> = { Sent: 'Enviados', Pending: 'Pendentes', Failed: 'Falharam' };
  const videoStatusBreakdown: NamedValue[] = videoStatusGroups.map((g) => ({
    name: statusLabel[g.status] ?? g.status,
    value: g._count._all,
    count: g._count._all,
  }));

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
    leadsByDay,
    videoStatusBreakdown,
    funnel: {
      views: viewsResponsesAgg._sum.surveyLinkViews ?? 0,
      responses: viewsResponsesAgg._sum.surveyLinkResponses ?? 0,
      leads: totalLeads,
      rewarded: rewardedLeads,
    },
  };
}
