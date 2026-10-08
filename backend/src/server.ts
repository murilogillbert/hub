import { createApp } from './app.js';
import { config } from './config.js';
import { avisarSePagamentoSimulado } from './infra/paymentGateways/index.js';
import { startPaymentReconciliation } from './jobs/paymentReconciliation.js';
import { startSurveyVideoDispatch } from './jobs/surveyVideoDispatch.js';
import { ensureAdmin } from './seed.js';

async function main(): Promise<void> {
  // Garante o admin bootstrap (mesmo sem seed demo).
  await ensureAdmin();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`OpenDriverHub API ouvindo em http://localhost:${config.port}`);
  });

  // Depois do `listen` e sem `await`: é diagnóstico, não deve atrasar o serviço a atender.
  void avisarSePagamentoSimulado();
  startPaymentReconciliation();
  startSurveyVideoDispatch();
}

main().catch((err) => {
  console.error('Falha ao iniciar o servidor', err);
  process.exit(1);
});
