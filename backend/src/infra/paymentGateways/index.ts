import { config } from '../../config.js';
import { AsaasGateway } from './asaas.js';
import { MercadoPagoGateway } from './mercadoPago.js';
import { MockPaymentGateway } from './mock.js';
import type { IPaymentGateway } from './types.js';

/** Gateway de pagamento selecionado por PAYMENT_PROVIDER. Convivem 3
 * implementações; o admin troca o provider sem recompilar (Payment:Provider). */
export let paymentGateway: IPaymentGateway =
  config.paymentProvider === 'mercadopago'
    ? new MercadoPagoGateway()
    : config.paymentProvider === 'asaas'
      ? new AsaasGateway()
      : new MockPaymentGateway();

/** Só para testes: injeta um gateway stub (ex.: sempre aprova), espelhando o
 * `new PaymentService(db, new ApprovedGateway())` do teste xUnit original. */
export function __setPaymentGatewayForTests(gateway: IPaymentGateway): void {
  paymentGateway = gateway;
}

export type { IPaymentGateway } from './types.js';
