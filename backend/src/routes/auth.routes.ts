import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  partnerRegisterSchema,
  resendVerificationSchema,
  confirmVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../dtos/auth.dto.js';
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

// Resposta sempre genérica (não revela se o e-mail existe/já foi verificado
// nem se a conta existe) — evita enumeração de contas cadastradas.
authRouter.post(
  '/verify-email/resend',
  authRateLimiter,
  validateBody(resendVerificationSchema),
  async (req, res) => {
    await authService.resendVerification(req.body.email);
    res.json(envelope({ message: 'Se o e-mail existir, enviamos um novo link de confirmação.' }));
  },
);

authRouter.post(
  '/verify-email/confirm',
  authRateLimiter,
  validateBody(confirmVerificationSchema),
  async (req, res) => {
    await authService.confirmEmailVerification(req.body.token);
    res.json(envelope({ message: 'E-mail confirmado.' }));
  },
);

authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validateBody(forgotPasswordSchema),
  async (req, res) => {
    await authService.forgotPassword(req.body.email);
    res.json(envelope({ message: 'Se o e-mail existir, enviamos um link de redefinição de senha.' }));
  },
);

authRouter.post(
  '/reset-password',
  authRateLimiter,
  validateBody(resetPasswordSchema),
  async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.newPassword);
    res.json(envelope({ message: 'Senha redefinida.' }));
  },
);
