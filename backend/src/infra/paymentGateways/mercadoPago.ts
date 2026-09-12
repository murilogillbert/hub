import crypto from 'node:crypto';
import { AppError } from '../../errors.js';
import { getSetting } from '../settingsProvider.js';
import * as codes from './paymentCodes.js';
import type {
  CardInput,
  IPaymentGateway,
  OrderForPayment,
  PaymentMethodCode,
  PaymentStatusSnapshot,
  PixPayload,
} from './types.js';

const BASE_URL = 'https://api.mercadopago.com/';

function mapStatus(s: string | undefined | null): 'approved' | 'rejected' | 'pending' {
  if (s === 'approved') return 'approved';
  if (s === 'rejected' || s === 'cancelled' || s === 'refunded' || s === 'charged_back')
    return 'rejected';
  return 'pending';
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSetting('MercadoPago:AccessToken');
  if (!token)
    throw new AppError(
      'Mercado Pago não configurado. Defina o Access Token em Admin → Integrações.',
      503,
    );
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** Mercado Pago REAL (api.mercadopago.com). Access token resolvido em runtime
 * via settingsProvider (banco sobrepõe .env). PIX cria cobrança e retorna
 * QR/copia-e-cola; cartão usa token gerado no front (SDK MP.js). */
export class MercadoPagoGateway implements IPaymentGateway {
  provider = 'mercadopago';

  async process(
    order: OrderForPayment,
    amount: number,
    method: PaymentMethodCode,
    card: CardInput | null | undefined,
  ): Promise<PaymentStatusSnapshot> {
    const headers = await authHeaders();
    const reference = codes.reference(order.id);
    const payerEmail = order.customer?.email ?? 'comprador@opendriverhub.com';
    const description = order.items[0]?.productTitle ?? `Pedido ${order.code}`;

    let body: Record<string, unknown>;
    if (method === 'Pix') {
      body = {
        transaction_amount: Math.round(amount * 100) / 100,
        description,
        payment_method_id: 'pix',
        external_reference: reference,
        payer: { email: payerEmail },
      };
    } else {
      if (!card?.token)
        throw new AppError('Pagamento com cartão requer o token do cartão (SDK Mercado Pago).', 400);
      body = {
        transaction_amount: Math.round(amount * 100) / 100,
        token: card.token,
        description,
        installments: card.installments ?? 1,
        payment_method_id: card.paymentMethodId,
        external_reference: reference,
        payer: { email: payerEmail },
      };
    }

    const resp = await fetch(`${BASE_URL}v1/payments`, {
      method: 'POST',
      headers: { ...headers, 'X-Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(body),
    });
    const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;

    if (!resp.ok) {
      const msg = raw?.message ?? 'Falha no Mercado Pago.';
      throw new AppError(`Mercado Pago: ${msg}`, 502);
    }

    const paymentId = String(raw.id);
    const status = mapStatus(raw.status);
    const detail = raw.status_detail ?? null;

    let pix: PixPayload | null = null;
    if (method === 'Pix' && raw.point_of_interaction?.transaction_data) {
      const td = raw.point_of_interaction.transaction_data;
      const qr = td.qr_code ?? '';
      pix = {
        qrCode: qr,
        copiaECola: qr,
        ticketUrl: td.ticket_url ?? '',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
    }

    const voucherCode = status === 'approved' ? codes.voucher() : null;
    return {
      orderId: order.id,
      paymentId,
      paymentReference: reference,
      paymentStatus: status,
      statusDetail: detail,
      voucherCode,
      orderStatus: order.status,
      pix,
    };
  }

  async sync(order: OrderForPayment): Promise<PaymentStatusSnapshot | null> {
    if (!order.externalPaymentId || order.status !== 'PendingPayment') return null;

    const headers = await authHeaders();
    const resp = await fetch(`${BASE_URL}v1/payments/${order.externalPaymentId}`, { headers });
    if (!resp.ok) return null;
    const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;
    const status = mapStatus(raw.status);
    if (status !== 'approved') return null;

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
}
