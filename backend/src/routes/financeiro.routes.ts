import { Router } from 'express';
import { adjustBalanceSchema, resolveWithdrawalSchema } from '../dtos/affiliate.dto.js';
import { envelope } from '../dtos/common.dto.js';
import { prisma } from '../infra/prisma.js';
import { ROLES, requireAuth, requireRole, userId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { toAffiliatePartnerDto } from '../mappings.js';
import * as affiliateWalletService from '../services/affiliateWalletService.js';

/** Área do financeiro — role especial (Financeiro ou Admin) pra aprovar
 * saques e ajustar manualmente o saldo de comissão de um afiliado. */
export const financeiroRouter = Router();
const guard = [requireAuth, requireRole(...ROLES.financeiro)] as const;

financeiroRouter.get('/affiliates', ...guard, async (_req, res) => {
  const rows = await prisma.partner.findMany({ where: { kind: 'SolarAffiliate' }, orderBy: { name: 'asc' } });
  res.json(envelope(rows.map(toAffiliatePartnerDto)));
});

financeiroRouter.get('/affiliates/:partnerId/entries', ...guard, async (req, res) => {
  const rows = await affiliateWalletService.listEntries(req.params.partnerId as string);
  res.json(envelope(rows));
});

financeiroRouter.post(
  '/affiliates/:partnerId/adjust-balance',
  ...guard,
  validateBody(adjustBalanceSchema),
  async (req, res) => {
    const entry = await affiliateWalletService.adjustBalance(req.params.partnerId as string, userId(req), req.body);
    res.json(envelope(entry));
  },
);

financeiroRouter.get('/withdrawals', ...guard, async (req, res) => {
  res.json(envelope(await affiliateWalletService.listWithdrawals(req.query.status as string | undefined)));
});

financeiroRouter.post('/withdrawals/:id/approve', ...guard, validateBody(resolveWithdrawalSchema), async (req, res) => {
  res.json(
    envelope(await affiliateWalletService.approveWithdrawal(req.params.id as string, userId(req), req.body.note)),
  );
});

financeiroRouter.post('/withdrawals/:id/reject', ...guard, validateBody(resolveWithdrawalSchema), async (req, res) => {
  res.json(
    envelope(await affiliateWalletService.rejectWithdrawal(req.params.id as string, userId(req), req.body.note)),
  );
});
