import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import { createOrderSchema, processPaymentSchema } from '../dtos/orders.dto.js';
import { createReviewSchema } from '../dtos/reviews.dto.js';
import { ROLES, requireAuth, requireRole, requireVerifiedEmail, userId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as orderService from '../services/orderService.js';
import * as paymentService from '../services/paymentService.js';
import * as reviewService from '../services/reviewService.js';

export const clientRouter = Router();

// Aplicado por rota (não via router.use()): catalogRouter, clientRouter e
// meRouter dividem o mesmo prefixo de montagem "/api/v1" em app.ts, então um
// guard "de router inteiro" interceptaria também rotas de OUTROS routers
// (partner/admin) que closed no mesmo prefixo — Express casa middlewares na
// ordem de registro, não pela rota mais específica.
const guard = [requireAuth, requireRole(...ROLES.client)] as const;

clientRouter.post('/orders', ...guard, validateBody(createOrderSchema), async (req, res) => {
  res.json(envelope(await orderService.createOrder(userId(req), req.body)));
});

clientRouter.get('/me/orders', ...guard, async (req, res) => {
  res.json(envelope(await orderService.myOrders(userId(req), req.query.status as string | undefined)));
});

clientRouter.get('/me/orders/:id', ...guard, async (req, res) => {
  res.json(envelope(await orderService.getMyOrder(userId(req), req.params.id as string)));
});

clientRouter.get('/me/cashback/entries', ...guard, async (req, res) => {
  res.json(envelope(await orderService.cashbackEntries(userId(req))));
});

clientRouter.get('/me/reviews/eligibility', ...guard, async (req, res) => {
  res.json(envelope(await reviewService.eligibility(userId(req), req.query.productId as string)));
});

clientRouter.post('/reviews', ...guard, validateBody(createReviewSchema), async (req, res) => {
  res.json(envelope(await reviewService.create(userId(req), req.body)));
});

clientRouter.post(
  '/payments/process',
  ...guard,
  requireVerifiedEmail,
  validateBody(processPaymentSchema),
  async (req, res) => {
    res.json(envelope(await paymentService.process(userId(req), req.body, req.ip)));
  },
);

clientRouter.get('/orders/:id/payment-status', ...guard, async (req, res) => {
  res.json(envelope(await paymentService.status(req.params.id as string)));
});
