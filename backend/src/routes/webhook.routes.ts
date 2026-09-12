import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { getSetting } from '../infra/settingsProvider.js';
import * as paymentService from '../services/paymentService.js';

/** Webhook do Mercado Pago com verificação de assinatura HMAC-SHA256 e
 * webhook do Asaas com token compartilhado. Públicos (server-to-server),
 * sem CORS/JWT. O segredo vem de Admin → Integrações (sobrepõe .env). */
export const webhookRouter = Router();

function verifyMpSignature(
  signatureHeader: string,
  requestId: string,
  dataId: string,
  secret: string,
  toleranceSeconds: number,
): { ok: boolean; reason: string } {
  if (!signatureHeader) return { ok: false, reason: 'missing_signature' };

  let ts: string | null = null;
  let v1: string | null = null;
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.split('=').map((s) => s.trim());
    if (k === 'ts') ts = v;
    else if (k === 'v1') v1 = v;
  }
  if (!ts || !v1) return { ok: false, reason: 'malformed_signature_header' };

  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) return { ok: false, reason: 'invalid_signature_timestamp' };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsSeconds) > toleranceSeconds) return { ok: false, reason: 'signature_timestamp_out_of_range' };

  // Manifest oficial do Mercado Pago.
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex').toLowerCase();

  const expectedBuf = Buffer.from(expected, 'utf8');
  const v1Buf = Buffer.from(v1.toLowerCase(), 'utf8');
  const match = expectedBuf.length === v1Buf.length && crypto.timingSafeEqual(expectedBuf, v1Buf);
  return match ? { ok: true, reason: 'ok' } : { ok: false, reason: 'signature_mismatch' };
}

webhookRouter.post('/mercadopago', async (req, res) => {
  const paymentId = (req.query['data.id'] as string | undefined) ?? (req.query.id as string | undefined);
  const eventType = (req.query.type as string | undefined) ?? 'payment';
  if (!paymentId) {
    res.status(400).json({ error: 'missing_data_id' });
    return;
  }

  const secret = await getSetting('MercadoPago:WebhookSecret');
  const requireSig = config.webhook.requireSignature;

  if (!secret) {
    if (requireSig) {
      res.status(503).json({ error: 'webhook_secret_not_configured' });
      return;
    }
    const status = await paymentService.reconcileByExternal(paymentId, eventType, null);
    res.json({ received: true, status });
    return;
  }

  const signature = String(req.headers['x-signature'] ?? '');
  const requestId = String(req.headers['x-request-id'] ?? '');
  const check = verifyMpSignature(signature, requestId, paymentId, secret, config.webhook.toleranceSeconds);
  if (!check.ok) {
    res.status(401).json({ error: check.reason });
    return;
  }

  const status = await paymentService.reconcileByExternal(paymentId, eventType, null);
  res.json({ received: true, status });
});

/** Body: { event, payment: { id, status, externalReference } }. */
webhookRouter.post('/asaas', async (req, res) => {
  const expected = await getSetting('Asaas:WebhookToken');
  const requireToken = config.webhook.requireSignature;

  if (!expected) {
    if (requireToken) {
      res.status(503).json({ error: 'webhook_token_not_configured' });
      return;
    }
  } else {
    const received = String(req.headers['asaas-access-token'] ?? '');
    const receivedBuf = Buffer.from(received, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const ok = received.length > 0 && receivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(receivedBuf, expectedBuf);
    if (!ok) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }
  }

  const eventType = req.body?.event ?? 'payment';
  const paymentId = req.body?.payment?.id as string | undefined;
  if (!paymentId) {
    res.status(400).json({ error: 'missing_payment_id' });
    return;
  }

  const rawPayload = JSON.stringify(req.body);
  const status = await paymentService.reconcileByExternal(paymentId, eventType, rawPayload);
  res.json({ received: true, status });
});
