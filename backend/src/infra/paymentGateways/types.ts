import type { Prisma } from '@prisma/client';

/** Formato de pedido que os gateways de pagamento precisam enxergar
 * (cliente + itens com parceiro, para o split do Asaas). */
export type OrderForPayment = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    items: { include: { partner: true } };
  };
}>;

export interface CardInput {
  number: string;
  holder: string;
  expiry: string;
  cvv: string;
  // CEP + número do endereço do titular — exigidos pelo Asaas na
  // tokenização (creditCardHolderInfo).
  postalCode?: string;
  addressNumber?: string;
  // Mercado Pago: token gerado no front via SDK. Asaas: token gerado pelo
  // nosso próprio backend via tokenizeCreditCard (ver asaas.ts).
  token?: string;
  paymentMethodId?: string;
  installments?: number;
}

export interface PixPayload {
  qrCode: string;
  copiaECola: string;
  ticketUrl: string;
  expiresAt: string;
}

export type PaymentMethodCode = 'Pix' | 'CreditCard' | 'DebitCard';

export interface PaymentStatusSnapshot {
  orderId: string;
  paymentId: string | null;
  paymentReference: string | null;
  paymentStatus: 'pending' | 'approved' | 'rejected' | 'cancelled';
  statusDetail: string | null;
  voucherCode: string | null;
  orderStatus: string;
  pix: PixPayload | null;
}

export interface IPaymentGateway {
  provider: string;
  process(
    order: OrderForPayment,
    amount: number,
    method: PaymentMethodCode,
    card: CardInput | null | undefined,
    remoteIp?: string,
  ): Promise<PaymentStatusSnapshot>;
  sync(order: OrderForPayment): Promise<PaymentStatusSnapshot | null>;
}
