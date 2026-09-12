import { Router } from 'express';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import * as affiliateLinkService from '../services/affiliateLinkService.js';

/** Link curto de indicação do afiliado (hub.com/r/CODE) — conta a visita e
 * redireciona pro formulário do cliente final (Formbricks). Montado na raiz
 * do app (fora de /api/v1) porque é um link pensado pra ser compartilhado. */
export const redirectRouter = Router();

redirectRouter.get('/r/:code', async (req, res) => {
  const code = req.params.code as string;
  if (!config.affiliate.formUrl)
    throw new AppError('Formulário do programa de afiliados ainda não configurado.', 503);

  await affiliateLinkService.recordClick(code);
  const url = new URL(config.affiliate.formUrl);
  url.searchParams.set('consultor', code);
  res.redirect(302, url.toString());
});
