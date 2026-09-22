import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import { getSetting } from '../infra/settingsProvider.js';
import { ROLES, requireAuth, requireRole, userId } from '../middleware/auth.js';
import * as surveyLeadService from '../services/surveyLeadService.js';
import * as surveyLinkService from '../services/surveyLinkService.js';

/** Pesquisa de opinião (link pessoal do motorista) — webhook público do
 * Formbricks + rota autenticada do motorista pra ver o próprio link/stats. */
export const surveyRouter = Router();

surveyRouter.get('/me', requireAuth, requireRole(...ROLES.client), async (req, res) => {
  res.json(envelope(await surveyLinkService.myLink(userId(req))));
});

/** Sem requireAuth — o Formbricks não manda um header de autenticação
 * próprio. A validação é o webhookId configurado em Admin → Integrações →
 * Pesquisa de opinião (mesmo nível de segurança que o webhook do n8n da
 * pesquisa solar já usa hoje: o segredo é o próprio id, não-adivinhável). */
surveyRouter.post('/webhook', async (req, res) => {
  const expected = await getSetting('Survey:ExpectedWebhookId');
  if (expected && req.body?.webhookId !== expected) {
    res.status(401).json({ error: 'invalid_webhook_id' });
    return;
  }
  await surveyLeadService.handleFormbricksWebhook(req.body);
  res.status(204).send();
});
