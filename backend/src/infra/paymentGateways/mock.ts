import * as codes from './paymentCodes.js';
import type {
  CardInput,
  IPaymentGateway,
  OrderForPayment,
  PaymentMethodCode,
  PaymentStatusSnapshot,
} from './types.js';

const REJECTED_TEST_CARD = '5031433215406351';
const FIVE_MINUTES_MS = 5 * 60 * 1000;

/** Gateway local (default). PIX confirma sozinho após a janela mínima de exibição. */
export class MockPaymentGateway implements IPaymentGateway {
  provider = 'mock';

  async process(
    order: OrderForPayment,
    amount: number,
    method: PaymentMethodCode,
    card: CardInput | null | undefined,
  ): Promise<PaymentStatusSnapshot> {
    const reference = codes.reference(order.id);
    const paymentId = codes.hex(6);

    if (method === 'Pix') {
      const pix = {
        qrCode: reference,
        copiaECola:
          `00020126580014BR.GOV.BCB.PIX0136${reference}5204000053039865406${amount.toFixed(2)}` +
          `5802BR5921OPENDRIVERHUB LTDA6009SAO PAULO62070503***6304${codes.hex(2)}`,
        ticketUrl: `https://mock.local/pix/${paymentId}`,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      return {
        orderId: order.id,
        paymentId,
        paymentReference: reference,
        paymentStatus: 'pending',
        statusDetail: 'pending_waiting_transfer',
        voucherCode: null,
        orderStatus: order.status,
        pix,
      };
    }

    const rejected = (card?.number ?? '').replace(/\s/g, '') === REJECTED_TEST_CARD;
    return {
      orderId: order.id,
      paymentId,
      paymentReference: reference,
      paymentStatus: rejected ? 'rejected' : 'approved',
      statusDetail: rejected ? 'cc_rejected_other_reason' : 'accredited',
      voucherCode: rejected ? null : codes.voucher(),
      orderStatus: order.status,
      pix: null,
    };
  }

  async sync(order: OrderForPayment): Promise<PaymentStatusSnapshot | null> {
    // PIX pendente confirma após 5 minutos para manter o QR disponível no checkout.
    if (
      order.paymentMethod === 'Pix' &&
      order.status === 'PendingPayment' &&
      Date.now() - order.createdAt.getTime() > FIVE_MINUTES_MS
    ) {
      return {
        orderId: order.id,
        paymentId: order.externalPaymentId,
        paymentReference: order.paymentReference,
        paymentStatus: 'approved',
        statusDetail: 'accredited',
        voucherCode: order.voucherCode ?? codes.voucher(),
        orderStatus: 'Paid',
        pix: null,
      };
    }
    return null;
  }
}
