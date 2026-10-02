import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import {
  changePasswordSchema,
  deleteAccountSchema,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
  updateNotificationsSchema,
  updateProfileSchema,
} from '../dtos/auth.dto.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
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

meRouter.post('/me/notifications/read', requireAuth, async (req, res) => {
  await authService.markNotificationsRead(userId(req));
  res.status(204).send();
});

meRouter.put('/me/password', requireAuth, validateBody(changePasswordSchema), async (req, res) => {
  await authService.changePassword(userId(req), req.body);
  res.status(204).send();
});

// ---- App mobile (../../hub-mobile) ----

/** Registro do aparelho para notificação push. */
meRouter.post('/me/push-tokens', requireAuth, validateBody(registerPushTokenSchema), async (req, res) => {
  await authService.registerPushToken(userId(req), req.body);
  res.status(204).send();
});

meRouter.delete('/me/push-tokens', requireAuth, validateBody(unregisterPushTokenSchema), async (req, res) => {
  await authService.removePushToken(userId(req), req.body);
  res.status(204).send();
});

/**
 * Exclusão de conta pedida dentro do app (App Store 5.1.1(v)) — anonimiza, preservando pedidos.
 *
 * `authRateLimiter` porque a rota confere a senha e responde diferente para senha certa e errada:
 * sem limite, um token roubado viraria um oráculo para adivinhar a senha. Mesmo tratamento que o
 * OpenDriver dá ao `/me/delete` dele.
 */
meRouter.post('/me/delete', requireAuth, authRateLimiter, validateBody(deleteAccountSchema), async (req, res) => {
  await authService.deleteAccount(userId(req), req.body);
  res.status(204).send();
});
