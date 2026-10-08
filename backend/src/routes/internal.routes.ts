import { Router } from 'express';
import { z } from 'zod';
import { adCreditChargeSchema } from '../dtos/adCredit.dto.js';
import { envelope } from '../dtos/common.dto.js';
import * as adCreditCharges from '../infra/adCreditCharges.js';
import { requireApiKey } from '../middleware/apiKey.js';
import { validateBody } from '../middleware/validate.js';
import * as accountPurgeService from '../services/accountPurgeService.js';

/**
 * Rotas internas chamadas pelo OpenDriver (nunca por usuário logado nem pelo navegador), quando a
 * pessoa exclui a conta pelo app de corridas: a conta é a mesma, mas cada serviço é dono do seu
 * schema, então quem recebe o pedido pede ao outro que apague o lado dele.
 *
 * Mesma autenticação das outras integrações servidor-a-servidor: `service_api_keys` com escopo.
 */
export const internalRouter = Router();
const uuid = (v: unknown) => z.string().uuid().parse(v);

internalRouter.get('/internal/accounts/:userId/deletion-blockers', requireApiKey('account:read'), async (req, res) => {
  res.json(envelope({ blockers: await accountPurgeService.deletionBlockers(uuid(req.params.userId)) }));
});

/** Idempotente: repetir numa conta já anonimizada não é erro (permite reexecutar a exclusão). */
internalRouter.post('/internal/accounts/:userId/purge', requireApiKey('account:purge'), async (req, res) => {
  await accountPurgeService.purgeHubAccount(uuid(req.params.userId));
  res.status(204).send();
});

/**
 * Cobrança Pix de crédito de veiculação, pedida pelo **OpenAd**.
 *
 * A conta do Asaas é do hub e as credenciais vivem em `public.integration_settings`, que é do
 * hub — então é o hub que cobra. O OpenAd grava a compra, pede a cobrança aqui, e devolve o
 * copia-e-cola ao anunciante.
 *
 * O caminho de volta não é esta rota: quando o Asaas confirma, o webhook do hub reconsulta o
 * status no provedor e chama `POST /internal/ads/credits/:purchaseId/confirm` no OpenAd. Nada
 * do corpo do webhook é tratado como verdade — ver `services/adCreditService.ts`.
 *
 * Não grava nada no hub. O registro da compra é do OpenAd (`openad.ad_credit_purchases`), e o
 * do pagamento aparece em `payment_events` quando o webhook chega. Guardar uma terceira cópia
 * aqui criaria dois lugares a manter em sincronia sem nenhum leitor para a segunda.
 */
internalRouter.post(
  '/internal/ads/credit-charges',
  requireApiKey('ads:credit:charge'),
  validateBody(adCreditChargeSchema),
  async (req, res) => {
    const { reference, userId, amountCents, description } = req.body;
    const cobranca = await adCreditCharges.criarCobrancaPix({
      purchaseId: reference,
      userId,
      amountCents,
      description,
    });
    res.status(201).json(envelope(cobranca));
  },
);
