import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { __setPaymentGatewayForTests } from '../src/infra/paymentGateways/index.js';
import type { IPaymentGateway, OrderForPayment, PaymentStatusSnapshot } from '../src/infra/paymentGateways/types.js';
import { TestDb } from './testDb.js';

class ApprovedGateway implements IPaymentGateway {
  provider = 'test';
  async process(order: OrderForPayment): Promise<PaymentStatusSnapshot> {
    return {
      orderId: order.id,
      paymentId: 'pay_1',
      paymentReference: 'ref_1',
      paymentStatus: 'approved',
      statusDetail: null,
      voucherCode: 'VOUCHER',
      orderStatus: 'PendingPayment',
      pix: null,
    };
  }
  async sync(): Promise<PaymentStatusSnapshot | null> {
    return null;
  }
}

describe('paymentService.process', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await TestDb.start();
    __setPrismaForTests(db.prisma);
    __setPaymentGatewayForTests(new ApprovedGateway());
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  it('approved payment updates cashback balance and ledger', async () => {
    const { process } = await import('../src/services/paymentService.js');

    const partner = await db.prisma.partner.create({ data: { name: 'Cafe', segment: 'Food', active: true } });
    const customer = await db.prisma.user.create({
      data: { name: 'Ana', email: 'ana@example.com', passwordHash: 'x', cashbackBalance: 20 },
    });
    const product = await db.prisma.product.create({
      data: {
        partnerId: partner.id,
        title: 'Combo',
        description: 'Cafe',
        price: 50,
        cashbackPercent: 10,
        kind: 'Voucher',
        category: 'Food',
        stock: 10,
      },
    });
    const order = await db.prisma.order.create({
      data: {
        code: 'ABC123',
        customerId: customer.id,
        paidPrice: 50,
        cashbackUsed: 15,
        cashbackEarned: 5,
        status: 'PendingPayment',
        items: {
          create: [
            {
              productId: product.id,
              partnerId: partner.id,
              productTitle: product.title,
              category: product.category,
              unitPrice: 50,
              quantity: 1,
              cashbackPercent: 10,
              lineTotal: 50,
              cashbackEarned: 5,
            },
          ],
        },
      },
    });

    const snapshot = await process(customer.id, { orderId: order.id, method: 'pix', card: null });

    expect(snapshot.paymentStatus).toBe('approved');

    const updatedOrder = await db.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('Paid');

    const updatedCustomer = await db.prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
    expect(updatedCustomer.cashbackBalance.toNumber()).toBe(10);

    const entries = await db.prisma.cashbackEntry.findMany({ where: { orderId: order.id } });
    expect(entries).toHaveLength(2);
    expect(entries.some((e) => e.type === 'Used' && e.amount.toNumber() === 15)).toBe(true);
    expect(entries.some((e) => e.type === 'Earned' && e.amount.toNumber() === 5)).toBe(true);
  });
});
