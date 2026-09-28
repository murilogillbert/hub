import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { envelope } from '../dtos/common.dto.js';
import { getSetting } from '../infra/settingsProvider.js';
import { requireAuth, requireRole, userId } from '../middleware/auth.js';
import * as surveyLeadService from '../services/surveyLeadService.js';
import * as surveyLinkService from '../services/surveyLinkService.js';

declare global {
  namespace Express {
    interface Request {
      /** Corpo cru (antes do JSON.parse) — só populado pelo verify() do
       * express.json() em app.ts, usado pra checar a assinatura do webhook. */
      rawBody?: Buffer;
    }
  }
}

/** Pesquisa de opinião (link pessoal do motorista OU do parceiro — mesma
 * mecânica pros dois papéis) — webhook público do Formbricks + rota
 * autenticada pra ver o próprio link/stats. */
export const surveyRouter = Router();

surveyRouter.get('/me', requireAuth, requireRole('Client', 'Passenger', 'Driver', 'Partner', 'Admin'), async (req, res) => {
  res.json(envelope(await surveyLinkService.myLink(userId(req))));
});

/** Verifica a assinatura Svix que o Formbricks manda em todo webhook
 * (headers webhook-id/webhook-timestamp/webhook-signature) — mesmo esquema
 * usado por vários provedores (Clerk, Resend, ...). O segredo (whsec_...)
 * vem de quando o webhook foi criado na Management API do Formbricks. */
function verifySvixSignature(secret: string, id: string, timestamp: string, rawBody: Buffer, signatureHeader: string): boolean {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const expectedBuf = Buffer.from(expected, 'utf8');

  return signatureHeader.split(' ').some((part) => {
    const sig = part.startsWith('v1,') ? part.slice(3) : part;
    const sigBuf = Buffer.from(sig, 'utf8');
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

/** Sem requireAuth — o Formbricks autentica via assinatura HMAC (Svix), não
 * por header custom. Se Survey:WebhookSecret não estiver configurado ainda,
 * cai pro webhookId simples (mesmo nível de segurança que o webhook do n8n
 * da pesquisa solar já usa). Sem nenhum dos dois, falha fechada (503) —
 * cada lead inédito paga o motorista, então aceitar POST anônimo abriria
 * caminho pra leads falsos. Só em dev (PAYMENT_WEBHOOK_REQUIRE_SIGNATURE=false)
 * aceita sem configuração, como os webhooks de pagamento. */
surveyRouter.post('/webhook', async (req, res) => {
  const secret = await getSetting('Survey:WebhookSecret');

  if (secret) {
    const id = String(req.headers['webhook-id'] ?? '');
    const timestamp = String(req.headers['webhook-timestamp'] ?? '');
    const signature = String(req.headers['webhook-signature'] ?? '');
    const raw = req.rawBody;
    if (!raw || !id || !timestamp || !signature || !verifySvixSignature(secret, id, timestamp, raw, signature)) {
      res.status(401).json({ error: 'invalid_signature' });
      return;
    }
  } else {
    const expectedId = await getSetting('Survey:ExpectedWebhookId');
    if (!expectedId) {
      if (config.webhook.requireSignature) {
        res.status(503).json({ error: 'webhook_secret_not_configured' });
        return;
      }
    } else if (req.body?.webhookId !== expectedId) {
      res.status(401).json({ error: 'invalid_webhook_id' });
      return;
    }
  }

  await surveyLeadService.handleFormbricksWebhook(req.body);
  res.status(204).send();
});
