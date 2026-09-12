import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import { changePasswordSchema, updateNotificationsSchema, updateProfileSchema } from '../dtos/auth.dto.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as authService from '../services/authService.js';

/** Perfil do usuário autenticado — qualquer papel (cliente, parceiro, admin).
 * requireAuth é aplicado por rota (não via router.use()): catalogRouter,
 * clientRouter e meRouter dividem o mesmo prefixo "/api/v1" em app.ts, e um
 * guard de router inteiro interceptaria também rotas de outros routers. */
export const meRouter = Router();

meRouter.put('/me/profile', requireAuth, validateBody(updateProfileSchema), async (req, res) => {
  res.json(envelope(await authService.updateProfile(userId(req), req.body)));
});

meRouter.put('/me/notifications', requireAuth, validateBody(updateNotificationsSchema), async (req, res) => {
  await authService.updateNotifications(userId(req), req.body);
  res.status(204).send();
});

meRouter.get('/me/notifications', requireAuth, async (req, res) => {
  res.json(envelope(await authService.notifications(userId(req))));
});

meRouter.put('/me/password', requireAuth, validateBody(changePasswordSchema), async (req, res) => {
  await authService.changePassword(userId(req), req.body);
  res.status(204).send();
});
