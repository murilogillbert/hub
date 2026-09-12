import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import { loginSchema, refreshSchema, registerSchema, partnerRegisterSchema } from '../dtos/auth.dto.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import * as authService from '../services/authService.js';

export const authRouter = Router();

// Rate limit só nas rotas de força-bruta (registro/login/refresh). "/me" é
// uma checagem de sessão chamada a cada carregamento de página — se ficasse
// no mesmo balde, poucas navegações rápidas (ou StrictMode em dev) já
// esgotam o limite e o front, ao ver a falha, encerraria a sessão à toa.
authRouter.post('/register', authRateLimiter, validateBody(registerSchema), async (req, res) => {
  res.json(envelope(await authService.register(req.body)));
});

authRouter.post(
  '/register/partner',
  authRateLimiter,
  validateBody(partnerRegisterSchema),
  async (req, res) => {
    res.json(envelope(await authService.registerPartner(req.body)));
  },
);

authRouter.post('/login', authRateLimiter, validateBody(loginSchema), async (req, res) => {
  res.json(envelope(await authService.login(req.body)));
});

authRouter.post('/refresh', authRateLimiter, validateBody(refreshSchema), async (req, res) => {
  res.json(envelope(await authService.refresh(req.body.refreshToken)));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(envelope(await authService.me(userId(req))));
});
