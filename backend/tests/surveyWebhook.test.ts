import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../src/config.js';
import { __setPrismaForTests } from '../src/infra/prisma.js';

/**
 * Webhook da pesquisa (Formbricks): cada lead inédito paga o motorista, então
 * sem Survey:WebhookSecret nem Survey:ExpectedWebhookId ele tem que recusar
 * (falha fechada), e não aceitar POST anônimo. Prisma falso: sem Docker.
 */
const handled = vi.fn();
vi.mock('../src/services/surveyLeadService.js', () => ({
  handleFormbricksWebhook: (body: unknown) => handled(body),
}));

const { surveyRouter } = await import('../src/routes/survey.routes.js');

const settings = new Map<string, string>();
__setPrismaForTests({
  integrationSetting: {
    findUnique: async ({ where }: { where: { key: string } }) => {
      const value = settings.get(where.key);
      return value === undefined ? null : { key: where.key, value };
    },
  },
} as unknown as PrismaClient);

let server: Server;
let base = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/survey', surveyRouter);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/survey`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const post = (body: unknown) =>
  fetch(`${base}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('POST /survey/webhook', () => {
  const env = { secret: process.env.Survey__WebhookSecret, id: process.env.Survey__ExpectedWebhookId };

  beforeEach(() => {
    settings.clear();
    handled.mockClear();
    delete process.env.Survey__WebhookSecret;
    delete process.env.Survey__ExpectedWebhookId;
    config.webhook.requireSignature = true;
  });

  afterAll(() => {
    if (env.secret !== undefined) process.env.Survey__WebhookSecret = env.secret;
    if (env.id !== undefined) process.env.Survey__ExpectedWebhookId = env.id;
  });

  it('recusa quando nada está configurado (falha fechada)', async () => {
    const res = await post({ webhookId: 'qualquer', data: {} });
    expect(res.status).toBe(503);
    expect(handled).not.toHaveBeenCalled();
  });

  it('aceita sem configuração só com a assinatura desligada (dev)', async () => {
    config.webhook.requireSignature = false;
    const res = await post({ data: {} });
    expect(res.status).toBe(204);
    expect(handled).toHaveBeenCalledOnce();
  });

  it('com o webhookId configurado, confere o id', async () => {
    settings.set('Survey:ExpectedWebhookId', 'wh_123');
    expect((await post({ webhookId: 'outro' })).status).toBe(401);
    expect(handled).not.toHaveBeenCalled();
    expect((await post({ webhookId: 'wh_123' })).status).toBe(204);
    expect(handled).toHaveBeenCalledOnce();
  });

  it('com o secret configurado, exige assinatura', async () => {
    settings.set('Survey:WebhookSecret', 'whsec_' + Buffer.from('segredo-de-teste').toString('base64'));
    expect((await post({ webhookId: 'wh_123' })).status).toBe(401);
    expect(handled).not.toHaveBeenCalled();
  });
});
