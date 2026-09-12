import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { adminRouter } from './routes/admin.routes.js';
import { affiliatePublicRouter } from './routes/affiliatePublic.routes.js';
import { assistantRouter } from './routes/assistant.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { catalogRouter } from './routes/catalog.routes.js';
import { clientRouter } from './routes/client.routes.js';
import { financeiroRouter } from './routes/financeiro.routes.js';
import { meRouter } from './routes/me.routes.js';
import { partnerRouter } from './routes/partner.routes.js';
import { redirectRouter } from './routes/redirect.routes.js';
import { serviceRouter } from './routes/service.routes.js';
import { uploadsRouter } from './routes/uploads.routes.js';
import { webhookRouter } from './routes/webhook.routes.js';

export function createApp() {
  const app = express();

  // Confia em exatamente 1 hop de proxy reverso para obter o IP real (rate
  // limit / webhook) — `true` confiaria em qualquer proxy e permitiria
  // spoofar X-Forwarded-For para burlar o rate limit.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Link curto de indicação do afiliado — fora de /api/v1 de propósito
  // (pensado pra ser compartilhado como hub.com/r/CODE).
  app.use(redirectRouter);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1', catalogRouter);
  app.use('/api/v1', clientRouter);
  app.use('/api/v1', meRouter);
  app.use('/api/v1', affiliatePublicRouter);
  app.use('/api/v1/assistant', assistantRouter);
  app.use('/api/v1/partner', partnerRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/financeiro', financeiroRouter);
  app.use('/api/v1/service', serviceRouter);
  app.use('/api/v1/payments/webhook', webhookRouter);
  app.use('/api/v1/uploads', uploadsRouter);

  app.use(errorHandler);

  return app;
}
