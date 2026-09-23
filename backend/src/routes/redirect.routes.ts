import { Router } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { getSetting } from '../infra/settingsProvider.js';
import * as affiliateLinkService from '../services/affiliateLinkService.js';
import * as driverAffiliateService from '../services/driverAffiliateService.js';
import * as surveyLinkService from '../services/surveyLinkService.js';

/** Link curto de indicação do afiliado (hub.com/r/CODE) — conta a visita e
 * redireciona pro formulário do cliente final (Formbricks). Montado na raiz
 * do app (fora de /api/v1) porque é um link pensado pra ser compartilhado. */
export const redirectRouter = Router();

/** Link pessoal do motorista pra pesquisa de opinião (hub.com/r/pesquisa/CODE)
 * — mesmo formato do /r/:code do afiliado, mas pra User (Client) em vez de
 * Partner, e a URL da survey é editável em Admin → Integrações sem redeploy.
 * Precisa vir ANTES de /r/:code, senão "pesquisa" seria casado como code. */
redirectRouter.get('/r/pesquisa/:code', async (req, res) => {
  const code = req.params.code as string;
  const formUrl = await getSetting('Survey:FormUrl');
  if (!formUrl) throw new AppError('Pesquisa de opinião ainda não configurada.', 503);

  await surveyLinkService.recordClick(code);
  const url = new URL(formUrl);
  url.searchParams.set('motoristaCode', code);
  res.redirect(302, url.toString());
});

/** Link pessoal do motorista pra indicar o catálogo de UMA loja específica
 * (hub.com/r/indicacao/ID) — programa novo de afiliação loja↔motorista,
 * independente da pesquisa de opinião. ID é o próprio id da linha
 * DriverAffiliate (par motorista+loja já é unicamente identificado por ela,
 * sem precisar inventar mais um código). Precisa vir ANTES de /r/:code.
 * Comissão de verdade é creditada só se o comprador digitar o código do
 * motorista no checkout — este link é só o atalho pro catálogo + contagem
 * de visita pra métricas (ver driverAffiliateService.recordClickAndGetPartnerId). */
redirectRouter.get('/r/indicacao/:id', async (req, res) => {
  const id = req.params.id as string;
  const partnerId = await driverAffiliateService.recordClickAndGetPartnerId(id);
  if (!partnerId) throw new AppError('Link de indicação inválido.', 404);
  res.redirect(302, `${config.frontendUrl}/produtos?partnerId=${partnerId}`);
});

redirectRouter.get('/r/:code', async (req, res) => {
  const code = req.params.code as string;
  if (!config.affiliate.formUrl)
    throw new AppError('Formulário do programa de afiliados ainda não configurado.', 503);

  await affiliateLinkService.recordClick(code);
  const url = new URL(config.affiliate.formUrl);
  url.searchParams.set('affiliateCode', code);
  res.redirect(302, url.toString());
});
