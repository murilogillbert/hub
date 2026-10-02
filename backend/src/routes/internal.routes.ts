import { Router } from 'express';
import { z } from 'zod';
import { envelope } from '../dtos/common.dto.js';
import { requireApiKey } from '../middleware/apiKey.js';
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
