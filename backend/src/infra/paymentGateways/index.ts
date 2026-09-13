import { config } from '../../config.js';
import { AsaasGateway } from './asaas.js';
import { MercadoPagoGateway } from './mercadoPago.js';
import { MockPaymentGateway } from './mock.js';
import type { IPaymentGateway } from './types.js';

/** Gateway de pagamento selecionado por PAYMENT_PROVIDER (env, lido uma vez no
 * boot) — convivem 3 implementações. Trocar o provider em produção exige
 * mudar a env var e redeployar; não há troca em runtime pelo Admin →
 * Integrações (diferente das credenciais de cada gateway, essas sim
 * editáveis ali sem redeploy). */
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
