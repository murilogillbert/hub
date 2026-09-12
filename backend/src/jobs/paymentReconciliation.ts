import * as paymentService from '../services/paymentService.js';

/** Reconciliação periódica de pagamentos PIX pendentes (simula webhook),
 * espelhando o BackgroundService do .NET original. */
export function startPaymentReconciliation(): NodeJS.Timeout {
  const tick = async (): Promise<void> => {
    try {
      await paymentService.reconcilePending();
    } catch (err) {
      console.warn('Falha na reconciliação de pagamentos', err);
    }
  };
  void tick();
  return setInterval(tick, 5_000);
}
