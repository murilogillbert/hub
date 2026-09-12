import { Router } from 'express';
import {
  assistantChatRequestSchema,
  assistantLeadInputSchema,
  botInteractionInputSchema,
  lucroSubmissionSchema,
} from '../dtos/assistant.dto.js';
import { envelope } from '../dtos/common.dto.js';
import { optionalUserId } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';
import { validateBody } from '../middleware/validate.js';
import * as assistantService from '../services/assistantService.js';

export const assistantRouter = Router();

assistantRouter.post('/leads', validateBody(assistantLeadInputSchema), async (req, res) => {
  res.json(envelope(await assistantService.createLead(optionalUserId(req), req.body)));
});

assistantRouter.post('/interactions', validateBody(botInteractionInputSchema), async (req, res) => {
  await assistantService.recordInteraction(req.body);
  res.status(204).send();
});

assistantRouter.post('/chat', authRateLimiter, validateBody(assistantChatRequestSchema), async (req, res) => {
  res.json(envelope(await assistantService.chat(req.body, optionalUserId(req))));
});

/** Submissão da calculadora de lucro real do motorista. Endpoint público
 * (não exige login). Persiste consentimento LGPD auditável em AuditLog +
 * AssistantLead minimalista. */
assistantRouter.post(
  '/lucro-submissions',
  authRateLimiter,
  validateBody(lucroSubmissionSchema),
  async (req, res) => {
    const ip = req.ip ?? null;
    res.json(envelope(await assistantService.createLucroSubmission(optionalUserId(req), ip, req.body)));
  },
);
