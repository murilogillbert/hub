import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import { loginSchema, refreshSchema, registerSchema, partnerRegisterSchema } from '../dtos/auth.dto.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import * as authService from '../services/authService.js';

export const authRouter = Router();
authRouter.use(authRateLimiter);

authRouter.post('/register', validateBody(registerSchema), async (req, res) => {
  res.json(envelope(await authService.register(req.body)));
});

authRouter.post('/register/partner', validateBody(partnerRegisterSchema), async (req, res) => {
  res.json(envelope(await authService.registerPartner(req.body)));
});

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  res.json(envelope(await authService.login(req.body)));
});

authRouter.post('/refresh', validateBody(refreshSchema), async (req, res) => {
  res.json(envelope(await authService.refresh(req.body.refreshToken)));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(envelope(await authService.me(userId(req))));
});
