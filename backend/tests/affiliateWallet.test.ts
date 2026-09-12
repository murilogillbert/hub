import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { TestDb } from './testDb.js';

describe('affiliateWalletService', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await TestDb.start();
    __setPrismaForTests(db.prisma);
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  async function createAffiliate(commissionBalance = 100) {
    return db.prisma.partner.create({
      data: { name: 'Consultor Teste', segment: 'Afiliado Solar', kind: 'SolarAffiliate', commissionBalance },
    });
  }

  it('requestWithdrawal rejects amount above balance', async () => {
    const { requestWithdrawal } = await import('../src/services/affiliateWalletService.js');
    const partner = await createAffiliate(50);
    await expect(requestWithdrawal(partner.id, 60)).rejects.toThrow(/saldo disponível/);
  });

  it('approveWithdrawal debits the balance and marks the request Paid', async () => {
    const { requestWithdrawal, approveWithdrawal } = await import('../src/services/affiliateWalletService.js');
    const actorId = randomUUID();
    const partner = await createAffiliate(100);

    const request = await requestWithdrawal(partner.id, 40);
    expect(request.status).toBe('pending');

    const approved = await approveWithdrawal(request.id, actorId);
    expect(approved.status).toBe('paid');

    const updated = await db.prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(updated.commissionBalance.toNumber()).toBe(60);

    const entry = await db.prisma.affiliateCommissionEntry.findFirst({
      where: { externalReference: `withdrawal:${request.id}` },
    });
    expect(entry).not.toBeNull();
    expect(entry?.type).toBe('Debit');
    expect(entry?.amount.toNumber()).toBe(40);
  });

  it('approveWithdrawal is not double-appliable (already resolved)', async () => {
    const { requestWithdrawal, approveWithdrawal } = await import('../src/services/affiliateWalletService.js');
    const actorId = randomUUID();
    const partner = await createAffiliate(100);
    const request = await requestWithdrawal(partner.id, 20);

    await approveWithdrawal(request.id, actorId);
    await expect(approveWithdrawal(request.id, actorId)).rejects.toThrow(/já foi resolvido/);

    const updated = await db.prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(updated.commissionBalance.toNumber()).toBe(80);
  });

  it('rejectWithdrawal leaves the balance untouched', async () => {
    const { requestWithdrawal, rejectWithdrawal } = await import('../src/services/affiliateWalletService.js');
    const actorId = randomUUID();
    const partner = await createAffiliate(100);
    const request = await requestWithdrawal(partner.id, 30);

    const rejected = await rejectWithdrawal(request.id, actorId, 'sem comprovante');
    expect(rejected.status).toBe('rejected');

    const updated = await db.prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(updated.commissionBalance.toNumber()).toBe(100);
  });

  it('adjustBalance credits and debits correctly, blocking over-debit', async () => {
    const { adjustBalance } = await import('../src/services/affiliateWalletService.js');
    const actorId = randomUUID();
    const partner = await createAffiliate(10);

    await adjustBalance(partner.id, actorId, { type: 'credit', amount: 25, description: 'Comissão venda X' });
    let updated = await db.prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(updated.commissionBalance.toNumber()).toBe(35);

    await adjustBalance(partner.id, actorId, { type: 'debit', amount: 5, description: 'Correção' });
    updated = await db.prisma.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(updated.commissionBalance.toNumber()).toBe(30);

    await expect(
      adjustBalance(partner.id, actorId, { type: 'debit', amount: 1000, description: 'Erro' }),
    ).rejects.toThrow(/saldo disponível/);
  });

  it('rejects operations on a Marketplace partner (not an affiliate)', async () => {
    const { requestWithdrawal } = await import('../src/services/affiliateWalletService.js');
    const partner = await db.prisma.partner.create({ data: { name: 'Loja X', segment: 'Cafeteria' } });
    await expect(requestWithdrawal(partner.id, 10)).rejects.toThrow(/não é afiliado/);
  });
});
