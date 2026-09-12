import { Router } from 'express';
import { productUpsertSchema, storeUpsertSchema } from '../dtos/catalog.dto.js';
import { envelope } from '../dtos/common.dto.js';
import { redeemRequestSchema } from '../dtos/orders.dto.js';
import { ROLES, partnerId, requireAuth, requireRole, userId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as partnerService from '../services/partnerService.js';
import * as storeService from '../services/storeService.js';

export const partnerRouter = Router();
const guard = [requireAuth, requireRole(...ROLES.partner)] as const;

partnerRouter.get('/products', ...guard, async (req, res) => {
  res.json(envelope(await partnerService.myProducts(partnerId(req))));
});

partnerRouter.post('/products', ...guard, validateBody(productUpsertSchema), async (req, res) => {
  res.json(envelope(await partnerService.createProduct(partnerId(req), req.body)));
});

partnerRouter.put('/products/:id', ...guard, validateBody(productUpsertSchema), async (req, res) => {
  res.json(envelope(await partnerService.updateProduct(partnerId(req), req.params.id as string, req.body)));
});

partnerRouter.delete('/products/:id', ...guard, async (req, res) => {
  await partnerService.deleteProduct(partnerId(req), req.params.id as string);
  res.status(204).send();
});

partnerRouter.get('/stores', ...guard, async (req, res) => {
  res.json(envelope(await storeService.listForPartner(partnerId(req))));
});

partnerRouter.post('/stores', ...guard, validateBody(storeUpsertSchema), async (req, res) => {
  res.json(envelope(await storeService.createForPartner(partnerId(req), req.body)));
});

partnerRouter.put('/stores/:id', ...guard, validateBody(storeUpsertSchema), async (req, res) => {
  res.json(envelope(await storeService.updateForPartner(partnerId(req), req.params.id as string, req.body)));
});

partnerRouter.delete('/stores/:id', ...guard, async (req, res) => {
  await storeService.deleteForPartner(partnerId(req), req.params.id as string);
  res.status(204).send();
});

partnerRouter.get('/metrics', ...guard, async (req, res) => {
  res.json(envelope(await partnerService.metrics(partnerId(req))));
});

/** Valida o voucher (confirm=false) ou efetua o resgate (confirm=true). */
partnerRouter.post('/redeem', ...guard, validateBody(redeemRequestSchema), async (req, res) => {
  const confirm = req.query.confirm === 'true';
  res.json(envelope(await partnerService.redeem(partnerId(req), userId(req), req.body.code, confirm)));
});
