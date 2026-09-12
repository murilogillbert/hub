import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import { linkEventSchema } from '../dtos/affiliate.dto.js';
import { requireApiKey } from '../middleware/apiKey.js';
import { validateBody } from '../middleware/validate.js';
import * as affiliateLinkService from '../services/affiliateLinkService.js';

/** Rotas pra integrações servidor-a-servidor (energia-solar-api, n8n, ...),
 * autenticadas por ServiceApiKey (Authorization: Bearer <chave>), nunca por
 * usuário logado. */
export const serviceRouter = Router();

serviceRouter.get('/affiliates/:code', requireApiKey('affiliate:read'), async (req, res) => {
  res.json(envelope(await affiliateLinkService.lookup(req.params.code as string)));
});

serviceRouter.post(
  '/affiliates/:code/link-events',
  requireApiKey('affiliate:write'),
  validateBody(linkEventSchema),
  async (req, res) => {
    await affiliateLinkService.recordLinkEvent(req.params.code as string, req.body);
    res.status(204).send();
  },
);
