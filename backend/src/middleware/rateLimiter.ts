import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

/** Política "auth" por IP (anti força-bruta em /auth), espelhando o
 * FixedWindowRateLimiter do Program.cs original. */
export const authRateLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowSeconds * 1000,
  limit: config.rateLimit.authPermitLimit,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns instantes e tente novamente.' });
  },
});
