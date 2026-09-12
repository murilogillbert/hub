import { createApp } from './app.js';
import { config } from './config.js';
import { startPaymentReconciliation } from './jobs/paymentReconciliation.js';
import { ensureAdmin } from './seed.js';

async function main(): Promise<void> {
  // Garante o admin bootstrap (mesmo sem seed demo).
  await ensureAdmin();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`OpenDriverHub API ouvindo em http://localhost:${config.port}`);
  });

  startPaymentReconciliation();
}

main().catch((err) => {
  console.error('Falha ao iniciar o servidor', err);
  process.exit(1);
});
