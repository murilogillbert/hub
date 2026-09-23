import { Router } from 'express';
import { productUpsertSchema, storeUpsertSchema, updateMyPartnerProfileSchema } from '../dtos/catalog.dto.js';
import { envelope } from '../dtos/common.dto.js';
import { redeemRequestSchema } from '../dtos/orders.dto.js';
import { requestWithdrawalSchema, updatePixKeySchema } from '../dtos/affiliate.dto.js';
import { addDriverAffiliateSchema, bulkCommissionSchema, updateDriverAffiliateSchema } from '../dtos/driverAffiliate.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { ROLES, partnerId, requireAuth, requireRole, requireVerifiedEmail, userId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { toAffiliatePartnerDto } from '../mappings.js';
import * as affiliateWalletService from '../services/affiliateWalletService.js';
import * as campaignMaterialService from '../services/campaignMaterialService.js';
import * as driverAffiliateService from '../services/driverAffiliateService.js';
import * as partnerService from '../services/partnerService.js';
import * as storeService from '../services/storeService.js';
import * as whatsappConnectService from '../services/whatsappConnectService.js';

export const partnerRouter = Router();
const guard = [requireAuth, requireRole(...ROLES.partner)] as const;

partnerRouter.get('/products', ...guard, async (req, res) => {
  res.json(envelope(await partnerService.myProducts(partnerId(req))));
});

partnerRouter.post('/products', ...guard, validateBody(productUpsertSchema), async (req, res) => {
  res.json(envelope(await partnerService.createProduct(partnerId(req), req.body)));
});

partnerRouter.put('/products/:id', ...guard, validateBody(productUpsertSchema), async (req, res) => {
  res.json(envelope(await partnerService.updateProduct(partnerId(req), req.params.id as string, req.body)));
});

partnerRouter.delete('/products/:id', ...guard, async (req, res) => {
  await partnerService.deleteProduct(partnerId(req), req.params.id as string);
  res.status(204).send();
});

partnerRouter.get('/stores', ...guard, async (req, res) => {
  res.json(envelope(await storeService.listForPartner(partnerId(req))));
});

partnerRouter.post('/stores', ...guard, validateBody(storeUpsertSchema), async (req, res) => {
  res.json(envelope(await storeService.createForPartner(partnerId(req), req.body)));
});

partnerRouter.put('/stores/:id', ...guard, validateBody(storeUpsertSchema), async (req, res) => {
  res.json(envelope(await storeService.updateForPartner(partnerId(req), req.params.id as string, req.body)));
});

partnerRouter.delete('/stores/:id', ...guard, async (req, res) => {
  await storeService.deleteForPartner(partnerId(req), req.params.id as string);
  res.status(204).send();
});

partnerRouter.get('/metrics', ...guard, async (req, res) => {
  res.json(envelope(await partnerService.metrics(partnerId(req))));
});

/** Valida o voucher (confirm=false) ou efetua o resgate (confirm=true). */
partnerRouter.post('/redeem', ...guard, validateBody(redeemRequestSchema), async (req, res) => {
  const confirm = req.query.confirm === 'true';
  res.json(envelope(await partnerService.redeem(partnerId(req), userId(req), req.body.code, confirm)));
});

// ---------- Programa de afiliados (kind = SolarAffiliate) ----------

/** Perfil do parceiro logado — usado pelo front pra decidir qual menu mostrar
 * (loja do marketplace vs. área do afiliado). */
partnerRouter.get('/me', ...guard, async (req, res) => {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId(req) } });
  if (!partner) throw new AppError('Parceiro não encontrado.', 404);
  res.json(envelope(toAffiliatePartnerDto(partner)));
});

/** Autoatendimento: loja edita nome/segmento/CNPJ/logo/localização; afiliado
 * edita só localização (cidade/estado). feePercent/active/asaasWalletId
 * continuam exclusivos do Admin (AdminPartnersPage). */
partnerRouter.put(
  '/profile',
  ...guard,
  validateBody(updateMyPartnerProfileSchema),
  async (req, res) => {
    res.json(envelope(await partnerService.updateMyProfile(partnerId(req), req.body)));
  },
);

partnerRouter.get('/affiliate/entries', ...guard, async (req, res) => {
  res.json(envelope(await affiliateWalletService.listEntries(partnerId(req))));
});

partnerRouter.get('/affiliate/withdrawals', ...guard, async (req, res) => {
  res.json(envelope(await affiliateWalletService.myWithdrawals(partnerId(req))));
});

partnerRouter.post(
  '/affiliate/withdrawals',
  ...guard,
  requireVerifiedEmail,
  validateBody(requestWithdrawalSchema),
  async (req, res) => {
    res.json(
      envelope(
        await affiliateWalletService.requestWithdrawal(
          partnerId(req),
          req.body.amount,
          req.body.note,
          req.body.pixKey,
          req.body.pixKeyType,
        ),
      ),
    );
  },
);

partnerRouter.put(
  '/affiliate/pix-key',
  ...guard,
  validateBody(updatePixKeySchema),
  async (req, res) => {
    res.json(
      envelope(await affiliateWalletService.updatePixKey(partnerId(req), req.body.pixKey, req.body.pixKeyType)),
    );
  },
);

partnerRouter.get('/affiliate/materials', ...guard, async (_req, res) => {
  res.json(envelope(await campaignMaterialService.listActive()));
});

partnerRouter.post('/affiliate/whatsapp/connect', ...guard, async (req, res) => {
  res.json(envelope(await whatsappConnectService.connect(partnerId(req))));
});

partnerRouter.get('/affiliate/whatsapp/status', ...guard, async (req, res) => {
  res.json(envelope(await whatsappConnectService.status(partnerId(req))));
});

partnerRouter.delete('/affiliate/whatsapp', ...guard, async (req, res) => {
  await whatsappConnectService.disconnect(partnerId(req));
  res.status(204).send();
});

partnerRouter.get('/affiliate/link', ...guard, async (req, res) => {
  const partner = await prisma.partner.findUnique({ where: { id: partnerId(req) } });
  if (!partner) throw new AppError('Parceiro não encontrado.', 404);
  res.json(
    envelope({
      code: partner.referralCode,
      linkViews: partner.linkViews,
      linkLeads: partner.linkLeads,
      linkSales: partner.linkSales,
    }),
  );
});

// ---------- Afiliação loja↔motorista (programa novo, independente do solar) ----------

partnerRouter.get('/affiliate-drivers/search', ...guard, async (req, res) => {
  res.json(envelope(await driverAffiliateService.searchDrivers(partnerId(req), String(req.query.q ?? ''))));
});

partnerRouter.get('/affiliate-drivers/metrics', ...guard, async (req, res) => {
  res.json(envelope(await driverAffiliateService.storeMetrics(partnerId(req))));
});

partnerRouter.get('/affiliate-drivers', ...guard, async (req, res) => {
  res.json(envelope(await driverAffiliateService.listForPartner(partnerId(req))));
});

partnerRouter.post('/affiliate-drivers', ...guard, validateBody(addDriverAffiliateSchema), async (req, res) => {
  await driverAffiliateService.add(partnerId(req), req.body.driverId, req.body.commissionPercent);
  res.status(204).send();
});

partnerRouter.put(
  '/affiliate-drivers/bulk-commission',
  ...guard,
  validateBody(bulkCommissionSchema),
  async (req, res) => {
    await driverAffiliateService.bulkSetCommission(partnerId(req), req.body.commissionPercent);
    res.status(204).send();
  },
);

partnerRouter.put(
  '/affiliate-drivers/:driverId',
  ...guard,
  validateBody(updateDriverAffiliateSchema),
  async (req, res) => {
    await driverAffiliateService.updateCommission(partnerId(req), req.params.driverId as string, req.body.commissionPercent);
    res.status(204).send();
  },
);

partnerRouter.delete('/affiliate-drivers/:driverId', ...guard, async (req, res) => {
  await driverAffiliateService.remove(partnerId(req), req.params.driverId as string);
  res.status(204).send();
});
