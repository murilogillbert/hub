import { Router } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import * as paymentService from '../services/paymentService.js';

/** Rotas de manutenção interna — hoje só a reconciliação de pagamentos PIX
 * pendentes, que em hospedagem serverless (Vercel) não pode mais rodar como
 * um `setInterval` de processo contínuo (ver src/jobs/paymentReconciliation.ts,
 * usado só na hospedagem com processo persistente). Na Vercel isso vira um
 * Cron Job (vercel.json) chamando este endpoint periodicamente. */
export const internalRouter = Router();

// Vercel Cron Jobs sempre disparam via GET.
internalRouter.get('/reconcile-payments', async (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!config.cron.secret || token !== config.cron.secret)
    throw new AppError('Não autorizado.', 401);

  await paymentService.reconcilePending();
  res.json({ ok: true });
});
