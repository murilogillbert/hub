import type { ProcessPaymentRequest } from '../dtos/orders.dto.js';
import type { PaymentStatusSnapshot } from '../infra/paymentGateways/types.js';
import { AppError } from '../errors.js';
import { paymentGateway } from '../infra/paymentGateways/index.js';
import * as codes from '../infra/paymentGateways/paymentCodes.js';
import { prisma } from '../infra/prisma.js';
import { parsePaymentMethod } from '../mappings.js';
import type { Prisma } from '@prisma/client';

const orderInclude = { customer: true, items: { include: { partner: true } } } as const;
type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function parseStatus(s: string): 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Refunded' {
  switch (s) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Pending';
  }
}

export async function process(customerId: string, req: ProcessPaymentRequest): Promise<PaymentStatusSnapshot> {
  const order = await prisma.order.findFirst({ where: { id: req.orderId, customerId }, include: orderInclude });
  if (!order) throw new AppError('Pedido não encontrado.', 404);
  if (order.status !== 'PendingPayment') throw new AppError('Pedido não está aguardando pagamento.', 409);

  const method = parsePaymentMethod(req.method);

  // Valor cobrado = preço − cashback abatido (mín. 0).
  const chargeAmount = Math.max(0, order.paidPrice.toNumber() - order.cashbackUsed.toNumber());

  let snap: PaymentStatusSnapshot;
  if (chargeAmount <= 0) {
    // Cashback cobre 100% — aprovação imediata, sem gateway.
    snap = {
      orderId: order.id,
      paymentId: codes.hex(6),
      paymentReference: codes.reference(order.id),
      paymentStatus: 'approved',
      statusDetail: 'paid_with_cashback',
      voucherCode: codes.voucher(),
      orderStatus: order.status,
      pix: null,
    };
  } else {
    snap = await paymentGateway.process({ ...order, paymentMethod: method }, chargeAmount, method, req.card);
  }

  // approve() é quem transiciona pra "Paid" (+ credita/debita cashback);
  // aqui só cobrimos o caminho de recusa/cancelamento direto.
  const rejectedOrCancelled = snap.paymentStatus === 'rejected' || snap.paymentStatus === 'cancelled';

  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentMethod: method,
      paymentReference: snap.paymentReference,
      externalPaymentId: snap.paymentId,
      ...(rejectedOrCancelled ? { status: 'Cancelled' } : {}),
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      orderId: order.id,
      provider: paymentGateway.provider,
      externalReference: snap.paymentReference,
      externalPaymentId: snap.paymentId,
      method,
      amount: chargeAmount,
      status: parseStatus(snap.paymentStatus),
      statusDetail: snap.statusDetail,
      lastSyncedAt: new Date(),
    },
  });

  if (snap.paymentStatus === 'approved') await approve(order.id, snap.voucherCode);

  const finalStatus: OrderRow['status'] = snap.paymentStatus === 'approved' ? 'Paid' : rejectedOrCancelled ? 'Cancelled' : order.status;
  return { ...snap, orderStatus: finalStatus };
}

export async function status(orderId: string): Promise<PaymentStatusSnapshot> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude });
  if (!order) throw new AppError('Pedido não encontrado.', 404);

  let current = order;
  if (order.status === 'PendingPayment') {
    const sync = await paymentGateway.sync(order);
    if (sync?.paymentStatus === 'approved') {
      await approve(order.id, sync.voucherCode);
      current = (await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude }))!;
    }
  }

  return {
    orderId: current.id,
    paymentId: current.externalPaymentId,
    paymentReference: current.paymentReference,
    paymentStatus: current.status === 'Paid' ? 'approved' : current.status === 'Cancelled' ? 'cancelled' : 'pending',
    statusDetail: null,
    voucherCode: current.voucherCode,
    orderStatus: current.status,
    pix: null,
  };
}

export async function reconcilePending(): Promise<void> {
  const pending = await prisma.order.findMany({
    where: { status: 'PendingPayment', paymentMethod: 'Pix' },
    include: orderInclude,
  });
  for (const order of pending) {
    const sync = await paymentGateway.sync(order);
    if (sync?.paymentStatus === 'approved') await approve(order.id, sync.voucherCode);
  }
}

export async function reconcileByExternal(externalId: string, eventType: string, rawPayload: string | null): Promise<string> {
  const order = await prisma.order.findFirst({
    where: { OR: [{ externalPaymentId: externalId }, { paymentReference: externalId }] },
    include: orderInclude,
  });

  let result = 'ignored';
  if (order) {
    if (order.status === 'PendingPayment') {
      const sync = await paymentGateway.sync(order);
      if (sync?.paymentStatus === 'approved') {
        await approve(order.id, sync.voucherCode);
        result = 'approved';
      } else {
        result = 'pending';
      }
    } else {
      // Já processado anteriormente → idempotente, sem efeito colateral.
      result = order.status.toLowerCase();
    }
  }

  await prisma.paymentEvent.create({
    data: {
      provider: paymentGateway.provider,
      eventType,
      externalId,
      orderId: order?.id,
      status: result,
      rawPayload: rawPayload ?? undefined,
    },
  });
  return result;
}

async function approve(orderId: string, voucherCode: string | null): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { customer: true } });
    if (!order || order.status === 'Paid' || order.status === 'Redeemed') return;

    const voucher = order.voucherCode ?? voucherCode ?? codes.voucher();
    await tx.order.update({ where: { id: orderId }, data: { status: 'Paid', paidAt: new Date(), voucherCode: voucher } });

    // Carteira de cashback: abate o usado e credita o ganho na compra.
    const cashbackUsed = order.cashbackUsed.toNumber();
    const cashbackEarned = order.cashbackEarned.toNumber();
    let balance = order.customer.cashbackBalance.toNumber();
    if (cashbackUsed > 0) {
      balance = Math.max(0, balance - cashbackUsed);
      await addCashbackEntry(tx, orderId, order.customerId, order.code, 'Used', cashbackUsed);
    }
    if (cashbackEarned > 0) {
      balance += cashbackEarned;
      await addCashbackEntry(tx, orderId, order.customerId, order.code, 'Earned', cashbackEarned);
    }
    if (cashbackUsed > 0 || cashbackEarned > 0)
      await tx.user.update({ where: { id: order.customerId }, data: { cashbackBalance: balance } });

    await tx.notification.create({
      data: {
        userId: order.customerId,
        title: 'Pagamento confirmado',
        message: `Voucher do pedido ${order.code} liberado. Cashback de R$ ${cashbackEarned.toFixed(2)} creditado na sua conta.`,
      },
    });
  });
}

async function addCashbackEntry(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
  orderCode: string,
  type: 'Earned' | 'Used',
  amount: number,
): Promise<void> {
  const exists = await tx.cashbackEntry.findFirst({ where: { orderId, type } });
  if (exists) return;
  const description = type === 'Earned' ? `Cashback recebido no pedido ${orderCode}` : `Cashback usado no pedido ${orderCode}`;
  await tx.cashbackEntry.create({
    data: { userId, orderId, type, amount: Math.round(amount * 100) / 100, description },
  });
}
