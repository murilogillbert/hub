import { partnerNet, platformFeeFor } from '../../domain/commissionRules.js';
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

function mapStatus(s: string | undefined | null): 'approved' | 'rejected' | 'pending' {
  if (s === 'RECEIVED' || s === 'CONFIRMED' || s === 'RECEIVED_IN_CASH') return 'approved';
  if (
    s === 'REFUNDED' ||
    s === 'REFUND_REQUESTED' ||
    s === 'REFUND_IN_PROGRESS' ||
    s === 'CHARGEBACK_REQUESTED' ||
    s === 'CHARGEBACK_DISPUTE'
  )
    return 'rejected';
  return 'pending'; // PENDING, OVERDUE, AWAITING_RISK_ANALYSIS, ...
}

function extractError(body: Record<string, any>): string {
  const first = body?.errors?.[0];
  return first?.description ?? 'falha na comunicação com o Asaas';
}

async function baseUrlAndHeaders(): Promise<{ baseUrl: string; headers: Record<string, string> }> {
  const token = await getSetting('Asaas:ApiKey');
  if (!token) throw new AppError('Asaas não configurado. Defina a API Key em Admin → Integrações.', 503);
  const env = await getSetting('Asaas:Environment');
  const baseUrl =
    (env ?? '').toLowerCase() === 'production'
      ? 'https://api.asaas.com/v3/'
      : 'https://api-sandbox.asaas.com/v3/';
  return {
    baseUrl,
    headers: {
      access_token: token,
      'User-Agent': 'OpenDriverHub',
      'Content-Type': 'application/json',
    },
  };
}

/** Monta o split por parceiro (líquido = total − taxa − cashback). Só inclui
 * parceiros com carteira Asaas. Se a soma exceder o valor cobrado (ex.:
 * cliente abateu cashback), ignora o split e cai no repasse manual. */
function buildSplits(order: OrderForPayment, chargeAmount: number): { walletId: string; fixedValue: number }[] {
  const byPartner = new Map<string, { walletId: string; net: number }>();
  for (const item of order.items) {
    const walletId = item.partner?.asaasWalletId;
    if (!walletId) continue;
    const fee = platformFeeFor(item.lineTotal.toNumber(), item.partner.feePercent.toNumber());
    const net = partnerNet(item.lineTotal.toNumber(), fee, item.cashbackEarned.toNumber());
    const entry = byPartner.get(item.partnerId) ?? { walletId, net: 0 };
    entry.net += net;
    byPartner.set(item.partnerId, entry);
  }

  const splits = [...byPartner.values()]
    .map((v) => ({ walletId: v.walletId, fixedValue: Math.round(v.net * 100) / 100 }))
    .filter((s) => s.fixedValue > 0);

  const sum = splits.reduce((acc, s) => acc + s.fixedValue, 0);
  if (sum <= 0) return [];
  if (sum > chargeAmount) return [];
  return splits;
}

/** Asaas REAL (api.asaas.com / sandbox). Cria cliente + cobrança, retorna QR
 * PIX e divide o pagamento (split) entre os parceiros que possuem
 * AsaasWalletId — o líquido cai direto na conta deles. */
export class AsaasGateway implements IPaymentGateway {
  provider = 'asaas';

  async process(
    order: OrderForPayment,
    amount: number,
    method: PaymentMethodCode,
    card: CardInput | null | undefined,
  ): Promise<PaymentStatusSnapshot> {
    const { baseUrl, headers } = await baseUrlAndHeaders();
    const reference = codes.reference(order.id);

    const customerId = await this.ensureCustomer(baseUrl, headers, order);

    const splits = buildSplits(order, amount);
    const description = order.items[0]?.productTitle ?? `Pedido ${order.code}`;
    const body: Record<string, unknown> = {
      customer: customerId,
      billingType: method === 'Pix' ? 'PIX' : 'CREDIT_CARD',
      value: Math.round(amount * 100) / 100,
      dueDate: new Date().toISOString().slice(0, 10),
      externalReference: reference,
      description,
    };
    if (splits.length > 0) body.split = splits;

    if (method !== 'Pix') {
      if (!card?.token)
        throw new AppError('Pagamento com cartão no Asaas requer o token do cartão (tokenização).', 400);
      body.creditCardToken = card.token;
      body.remoteIp = '127.0.0.1';
    }

    const resp = await fetch(`${baseUrl}payments`, { method: 'POST', headers, body: JSON.stringify(body) });
    const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;

    if (!resp.ok) {
      const msg = extractError(raw);
      if (method !== 'Pix')
        return {
          orderId: order.id,
          paymentId: null,
          paymentReference: reference,
          paymentStatus: 'rejected',
          statusDetail: msg,
          voucherCode: null,
          orderStatus: order.status,
          pix: null,
        };
      throw new AppError(`Asaas: ${msg}`, 502);
    }

    const paymentId = raw.id as string;
    const status = mapStatus(raw.status);
    const detail = raw.status ?? null;

    let pix: PixPayload | null = null;
    if (method === 'Pix' && paymentId) pix = await this.fetchPix(baseUrl, headers, paymentId);

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
    const { baseUrl, headers } = await baseUrlAndHeaders();
    const resp = await fetch(`${baseUrl}payments/${order.externalPaymentId}`, { headers });
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

  private async ensureCustomer(
    baseUrl: string,
    headers: Record<string, string>,
    order: OrderForPayment,
  ): Promise<string> {
    // cpfCnpj: em sandbox o PIX exige CPF/CNPJ no cliente. Permitimos um CPF
    // de teste padrão via setting para o fluxo ser testável ponta a ponta.
    const defaultCpf = await getSetting('Asaas:DefaultCpfCnpj');
    const body: Record<string, unknown> = {
      name: order.customer?.name ?? 'Cliente OpenDriverHub',
      email: order.customer?.email,
      externalReference: order.customerId,
    };
    if (defaultCpf) body.cpfCnpj = defaultCpf;

    const resp = await fetch(`${baseUrl}customers`, { method: 'POST', headers, body: JSON.stringify(body) });
    const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;
    if (!resp.ok) throw new AppError(`Asaas (cliente): ${extractError(raw)}`, 502);
    const id = raw.id as string | undefined;
    if (!id) throw new AppError('Asaas não retornou o id do cliente.', 502);
    return id;
  }

  private async fetchPix(
    baseUrl: string,
    headers: Record<string, string>,
    paymentId: string,
  ): Promise<PixPayload | null> {
    const resp = await fetch(`${baseUrl}payments/${paymentId}/pixQrCode`, { headers });
    if (!resp.ok) return null;
    const raw = (await resp.json().catch(() => ({}))) as Record<string, any>;
    const payload = raw.payload ?? '';
    const image = raw.encodedImage as string | undefined;
    const expiresAt = raw.expirationDate
      ? new Date(raw.expirationDate).toISOString()
      : new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const imageUrl = image ? `data:image/png;base64,${image}` : '';
    return { qrCode: payload, copiaECola: payload, ticketUrl: imageUrl, expiresAt };
  }
}
