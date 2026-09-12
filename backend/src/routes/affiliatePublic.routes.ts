import { Router } from 'express';
import { affiliateApplicationSchema } from '../dtos/affiliate.dto.js';
import { envelope } from '../dtos/common.dto.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import * as affiliateApplicationService from '../services/affiliateApplicationService.js';

/** Landing page pública "quero ser afiliado" — sem autenticação. */
export const affiliatePublicRouter = Router();

affiliatePublicRouter.post(
  '/affiliate-applications',
  authRateLimiter,
  validateBody(affiliateApplicationSchema),
  async (req, res) => {
    res.json(envelope(await affiliateApplicationService.apply(req.body)));
  },
);
