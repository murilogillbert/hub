import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { TestDb } from './testDb.js';

describe('partnerService.redeem', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await TestDb.start();
    __setPrismaForTests(db.prisma);
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('when confirmed, marks order redeemed and writes audit log', async () => {
    const { redeem } = await import('../src/services/partnerService.js');

    const actorId = randomUUID();
    const partner = await db.prisma.partner.create({ data: { name: 'Bistro', segment: 'Food', feePercent: 10 } });
    const customer = await db.prisma.user.create({ data: { name: 'Bia', email: 'bia@example.com', passwordHash: 'x' } });
    const product = await db.prisma.product.create({
      data: {
        partnerId: partner.id,
        title: 'Voucher',
        description: 'Almoco',
        price: 80,
        cashbackPercent: 5,
        kind: 'Voucher',
        category: 'Food',
        stock: 2,
      },
    });
    const order = await db.prisma.order.create({
      data: {
        code: 'REDEEM123',
        customerId: customer.id,
        paidPrice: 80,
        cashbackEarned: 4,
        status: 'Paid',
        items: {
          create: [
            {
              productId: product.id,
              partnerId: partner.id,
              productTitle: product.title,
              category: product.category,
              unitPrice: 80,
              quantity: 1,
              cashbackPercent: 5,
              lineTotal: 80,
              cashbackEarned: 4,
            },
          ],
        },
      },
    });

    const result = await redeem(partner.id, actorId, 'REDE-EM123', true);

    expect(result.redeemed).toBe(true);

    const updatedOrder = await db.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('Redeemed');
    expect(updatedOrder.redeemedAt).not.toBeNull();

    const updatedProduct = await db.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updatedProduct.stock).toBe(1);

    const audit = await db.prisma.auditLog.findFirst({ where: { actorId, action: 'order.redeem', entityId: order.id } });
    expect(audit).not.toBeNull();

    const notification = await db.prisma.notification.findFirst({ where: { userId: customer.id, title: 'Voucher resgatado' } });
    expect(notification).not.toBeNull();
  });
});
