import type { Prisma } from '@prisma/client';
import type { DriverRewardPayoutDto, DriverRewardSummaryDto, MarkDriverRewardPaidRequest } from '../dtos/driverRewardPayout.dto.js';
import type { PagedResult } from '../dtos/common.dto.js';
import { toPage } from '../dtos/common.dto.js';
import { round2 } from '../domain/commissionRules.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';

type DriverRewardSource = MarkDriverRewardPaidRequest['source'];

const SOURCE_LABEL: Record<DriverRewardSource, string> = {
  DriverCommission: 'comissão de indicação',
  SurveyReward: 'pesquisa de opinião',
};

/** "Saldo devedor" de cada motorista, por fonte — ganho (DriverCommissionEntry
 * ou SurveyLead.rewardAmount) menos o que já foi repassado por fora
 * (DriverRewardPayout). Mostra todo motorista que já ganhou algo de alguma
 * das duas fontes, mesmo que já esteja tudo pago (mesmo padrão de
 * adminService.payoutSummary — mostra todo parceiro, não só quem tem saldo). */
export async function summary(): Promise<DriverRewardSummaryDto[]> {
  const [commissionByDriver, surveyByDriver, paidRows] = await Promise.all([
    prisma.driverCommissionEntry.groupBy({ by: ['driverId'], _sum: { amount: true } }),
    prisma.surveyLead.groupBy({ by: ['driverId'], where: { rewarded: true, driverId: { not: null } }, _sum: { rewardAmount: true } }),
    prisma.driverRewardPayout.groupBy({ by: ['driverId', 'source'], _sum: { amount: true } }),
  ]);

  const commissionEarnedMap = new Map(commissionByDriver.map((r) => [r.driverId, r._sum.amount?.toNumber() ?? 0]));
  const surveyEarnedMap = new Map(
    surveyByDriver.filter((r): r is typeof r & { driverId: string } => !!r.driverId).map((r) => [r.driverId, r._sum.rewardAmount?.toNumber() ?? 0]),
  );
  const paidMap = new Map<string, number>();
  for (const r of paidRows) paidMap.set(`${r.driverId}:${r.source}`, r._sum.amount?.toNumber() ?? 0);

  const driverIds = new Set<string>([...commissionEarnedMap.keys(), ...surveyEarnedMap.keys()]);
  if (driverIds.size === 0) return [];

  const drivers = await prisma.user.findMany({ where: { id: { in: [...driverIds] } }, select: { id: true, name: true, email: true } });
  const driverById = new Map(drivers.map((d) => [d.id, d]));

  return [...driverIds]
    .map((id) => {
      const d = driverById.get(id);
      const commissionEarned = round2(commissionEarnedMap.get(id) ?? 0);
      const commissionPaid = round2(paidMap.get(`${id}:DriverCommission`) ?? 0);
      const surveyEarned = round2(surveyEarnedMap.get(id) ?? 0);
      const surveyPaid = round2(paidMap.get(`${id}:SurveyReward`) ?? 0);
      return {
        driverId: id,
        driverName: d?.name ?? '—',
        driverEmail: d?.email ?? '',
        commissionEarned,
        commissionPaid,
        commissionOwed: Math.max(0, round2(commissionEarned - commissionPaid)),
        surveyEarned,
        surveyPaid,
        surveyOwed: Math.max(0, round2(surveyEarned - surveyPaid)),
      };
    })
    .sort((a, b) => a.driverName.localeCompare(b.driverName));
}

export async function history(driverId: string | undefined, page: number, pageSize: number): Promise<PagedResult<DriverRewardPayoutDto>> {
  const where = driverId ? { driverId } : {};
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(100, Math.max(1, pageSize));
  const total = await prisma.driverRewardPayout.count({ where });
  const rows = await prisma.driverRewardPayout.findMany({
    where,
    include: { driver: true },
    orderBy: { createdAt: 'desc' },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });
  return toPage(
    rows.map((p) => ({
      id: p.id,
      driverId: p.driverId,
      driverName: p.driver.name,
      source: p.source,
      amount: p.amount.toNumber(),
      note: p.note,
      createdAt: p.createdAt,
    })),
    total,
    safePage,
    safePageSize,
  );
}

async function earnedFor(tx: Prisma.TransactionClient, driverId: string, source: DriverRewardSource): Promise<number> {
  if (source === 'DriverCommission') {
    const agg = await tx.driverCommissionEntry.aggregate({ where: { driverId }, _sum: { amount: true } });
    return agg._sum.amount?.toNumber() ?? 0;
  }
  const agg = await tx.surveyLead.aggregate({ where: { driverId, rewarded: true }, _sum: { rewardAmount: true } });
  return agg._sum.rewardAmount?.toNumber() ?? 0;
}

/** Admin marca o saldo devedor (comissão de afiliado ou recompensa da
 * pesquisa) de um motorista como pago por fora (Pix) — lança o repasse e
 * desconta o mesmo valor do cashbackBalance dele, pra não deixar ele gastar
 * no app o que já foi pago fora. Sem `amount`, paga o saldo devedor inteiro
 * (zera). Nunca deixa o saldo de cashback ir negativo. */
export async function markPaid(actorId: string, driverId: string, req: MarkDriverRewardPaidRequest): Promise<void> {
  const driver = await prisma.user.findUnique({ where: { id: driverId } });
  if (!driver) throw new AppError('Motorista não encontrado.', 404);
  if (driver.role !== 'Driver') throw new AppError('Este usuário não é um motorista.', 400);

  await prisma.$transaction(async (tx) => {
    const earned = await earnedFor(tx, driverId, req.source);
    const paidAgg = await tx.driverRewardPayout.aggregate({ where: { driverId, source: req.source }, _sum: { amount: true } });
    const alreadyPaid = paidAgg._sum.amount?.toNumber() ?? 0;
    const owed = round2(earned - alreadyPaid);
    if (owed <= 0) throw new AppError('Não há saldo devedor para essa fonte.', 409);

    const amount = req.amount !== undefined ? round2(req.amount) : owed;
    if (amount <= 0) throw new AppError('Valor deve ser maior que zero.', 400);
    if (amount > owed + 0.01) throw new AppError(`Valor acima do saldo devedor (R$ ${owed.toFixed(2)}).`, 400);

    await tx.driverRewardPayout.create({
      data: { driverId, source: req.source, amount, note: (req.note ?? '').trim(), createdBy: actorId },
    });

    // Desconta do saldo de cashback — foi pago por fora, não pode também ser
    // gasto no app. Se o motorista já gastou parte desse crédito em compras
    // (saldo atual menor que o repasse), desconta só o que ainda existe —
    // nunca fica negativo — e o extrato reflete o valor realmente
    // descontado, não o valor cheio do repasse.
    const fresh = await tx.user.findUnique({ where: { id: driverId }, select: { cashbackBalance: true } });
    const currentBalance = fresh?.cashbackBalance.toNumber() ?? 0;
    const actualDeduction = round2(Math.min(amount, currentBalance));

    if (actualDeduction > 0) {
      await tx.user.update({ where: { id: driverId }, data: { cashbackBalance: { decrement: actualDeduction } } });
      await tx.cashbackEntry.create({
        data: {
          userId: driverId,
          type: 'Used',
          amount: actualDeduction,
          description: `Repasse manual — ${SOURCE_LABEL[req.source]} (pago por fora)`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'admin.driverRewardPayout.create',
        entityType: 'DriverRewardPayout',
        entityId: driverId,
        payloadJson: JSON.stringify({ driverId, source: req.source, amount, owedBefore: owed }),
      },
    });
  });
}
