import { Router } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { getSetting } from '../infra/settingsProvider.js';
import * as affiliateLinkService from '../services/affiliateLinkService.js';
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

redirectRouter.get('/r/:code', async (req, res) => {
  const code = req.params.code as string;
  if (!config.affiliate.formUrl)
    throw new AppError('Formulário do programa de afiliados ainda não configurado.', 503);

  await affiliateLinkService.recordClick(code);
  const url = new URL(config.affiliate.formUrl);
  url.searchParams.set('affiliateCode', code);
  res.redirect(302, url.toString());
});
