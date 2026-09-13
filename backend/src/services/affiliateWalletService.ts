import type { PixKeyType } from '@prisma/client';
import type {
  AdjustBalanceRequest,
  AffiliatePartnerDto,
  CommissionEntryDto,
  WithdrawalRequestDto,
} from '../dtos/affiliate.dto.js';
import { round2 } from '../domain/commissionRules.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import {
  toAffiliatePartnerDto,
  toCommissionEntryDto,
  toWithdrawalRequestDto,
  tryParseWithdrawalStatus,
} from '../mappings.js';

async function ensureAffiliate(partnerId: string) {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
  if (!partner) throw new AppError('Parceiro não encontrado.', 404);
  if (partner.kind !== 'SolarAffiliate') throw new AppError('Este parceiro não é afiliado do programa solar.', 403);
  return partner;
}

export async function listEntries(partnerId: string): Promise<CommissionEntryDto[]> {
  await ensureAffiliate(partnerId);
  const rows = await prisma.affiliateCommissionEntry.findMany({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toCommissionEntryDto);
}

export async function requestWithdrawal(
  partnerId: string,
  amount: number,
  note?: string,
  pixKeyOverride?: string,
  pixKeyTypeOverride?: PixKeyType,
): Promise<WithdrawalRequestDto> {
  const partner = await ensureAffiliate(partnerId);
  const value = round2(amount);
  if (value <= 0) throw new AppError('Valor deve ser maior que zero.', 400);
  if (value > partner.commissionBalance.toNumber())
    throw new AppError('Valor acima do saldo disponível.', 400);

  const pendingSum = await prisma.withdrawalRequest.aggregate({
    where: { partnerId, status: 'Pending' },
    _sum: { amount: true },
  });
  const alreadyPending = pendingSum._sum.amount?.toNumber() ?? 0;
  if (value + alreadyPending > partner.commissionBalance.toNumber())
    throw new AppError('Valor acima do saldo disponível (considerando saques já pendentes).', 400);

  // Chave Pix: usa a informada nesta requisição, senão a salva no perfil.
  const pixKey = pixKeyOverride ?? partner.pixKey ?? undefined;
  const pixKeyType = pixKeyOverride ? pixKeyTypeOverride : (partner.pixKeyType ?? undefined);
  if (!pixKey || !pixKeyType) throw new AppError('Cadastre sua chave Pix antes de solicitar um saque.', 400);

  const row = await prisma.withdrawalRequest.create({
    data: { partnerId, amount: value, note: (note ?? '').trim(), pixKey, pixKeyType },
    include: { partner: true },
  });
  return toWithdrawalRequestDto(row);
}

export async function updatePixKey(
  partnerId: string,
  pixKey: string,
  pixKeyType: PixKeyType,
): Promise<AffiliatePartnerDto> {
  await ensureAffiliate(partnerId);
  const updated = await prisma.partner.update({
    where: { id: partnerId },
    data: { pixKey: pixKey.trim(), pixKeyType },
  });
  return toAffiliatePartnerDto(updated);
}

export async function myWithdrawals(partnerId: string): Promise<WithdrawalRequestDto[]> {
  await ensureAffiliate(partnerId);
  const rows = await prisma.withdrawalRequest.findMany({
    where: { partnerId },
    include: { partner: true },
    orderBy: { requestedAt: 'desc' },
  });
  return rows.map(toWithdrawalRequestDto);
}

export async function listWithdrawals(status?: string): Promise<WithdrawalRequestDto[]> {
  const parsed = tryParseWithdrawalStatus(status);
  const rows = await prisma.withdrawalRequest.findMany({
    where: parsed ? { status: parsed } : {},
    include: { partner: true },
    orderBy: { requestedAt: 'desc' },
  });
  return rows.map(toWithdrawalRequestDto);
}

/** Aprovar = pagar (o financeiro já resolveu por fora, ex. Pix manual) — debita
 * o saldo e fecha o pedido como Paid numa única transação. */
export async function approveWithdrawal(id: string, actorId: string, note?: string): Promise<WithdrawalRequestDto> {
  const updated = await prisma.$transaction(async (tx) => {
    const request = await tx.withdrawalRequest.findUnique({ where: { id }, include: { partner: true } });
    if (!request) throw new AppError('Pedido de saque não encontrado.', 404);
    if (request.status !== 'Pending') throw new AppError('Este pedido já foi resolvido.', 409);
    if (request.amount.toNumber() > request.partner.commissionBalance.toNumber())
      throw new AppError('Saldo do afiliado insuficiente para este saque.', 409);

    await tx.affiliateCommissionEntry.create({
      data: {
        partnerId: request.partnerId,
        type: 'Debit',
        amount: request.amount,
        description: 'Saque aprovado',
        externalReference: `withdrawal:${request.id}`,
        createdBy: actorId,
      },
    });
    await tx.partner.update({
      where: { id: request.partnerId },
      data: { commissionBalance: { decrement: request.amount } },
    });
    return tx.withdrawalRequest.update({
      where: { id },
      data: { status: 'Paid', resolvedAt: new Date(), resolvedBy: actorId, ...(note ? { note } : {}) },
      include: { partner: true },
    });
  });
  return toWithdrawalRequestDto(updated);
}

export async function rejectWithdrawal(id: string, actorId: string, note?: string): Promise<WithdrawalRequestDto> {
  const request = await prisma.withdrawalRequest.findUnique({ where: { id } });
  if (!request) throw new AppError('Pedido de saque não encontrado.', 404);
  if (request.status !== 'Pending') throw new AppError('Este pedido já foi resolvido.', 409);

  const updated = await prisma.withdrawalRequest.update({
    where: { id },
    data: { status: 'Rejected', resolvedAt: new Date(), resolvedBy: actorId, ...(note ? { note } : {}) },
    include: { partner: true },
  });
  return toWithdrawalRequestDto(updated);
}

/** Ajuste manual do financeiro (fora do fluxo de saque) — ex.: comissão de
 * uma venda fechada por fora, ou correção. */
export async function adjustBalance(
  partnerId: string,
  actorId: string,
  req: AdjustBalanceRequest,
): Promise<CommissionEntryDto> {
  const partner = await ensureAffiliate(partnerId);
  const amount = round2(req.amount);
  if (amount <= 0) throw new AppError('Valor deve ser maior que zero.', 400);
  if (req.type === 'debit' && amount > partner.commissionBalance.toNumber())
    throw new AppError('Valor de débito maior que o saldo disponível.', 400);

  const [entry] = await prisma.$transaction([
    prisma.affiliateCommissionEntry.create({
      data: {
        partnerId,
        type: req.type === 'credit' ? 'Credit' : 'Debit',
        amount,
        description: req.description.trim(),
        createdBy: actorId,
      },
    }),
    prisma.partner.update({
      where: { id: partnerId },
      data: { commissionBalance: req.type === 'credit' ? { increment: amount } : { decrement: amount } },
    }),
  ]);
  return toCommissionEntryDto(entry);
}
