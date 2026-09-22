import { Router } from 'express';
import { createPayoutSchema } from '../dtos/admin.dto.js';
import { categoryUpsertSchema, partnerUpsertSchema, storeUpsertSchema } from '../dtos/catalog.dto.js';
import { envelope } from '../dtos/common.dto.js';
import { adminUserCreateSchema, adminUserUpdateSchema } from '../dtos/auth.dto.js';
import { updateSettingSchema } from '../dtos/settings.dto.js';
import { campaignMaterialSchema, createApiKeySchema } from '../dtos/affiliate.dto.js';
import { ROLES, requireAuth, requireRole, userId } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import * as adminService from '../services/adminService.js';
import * as affiliateApplicationService from '../services/affiliateApplicationService.js';
import * as assistantService from '../services/assistantService.js';
import * as campaignMaterialService from '../services/campaignMaterialService.js';
import * as categoryService from '../services/categoryService.js';
import * as categorySuggestionService from '../services/categorySuggestionService.js';
import * as serviceApiKeyService from '../services/serviceApiKeyService.js';
import * as settingsService from '../services/settingsService.js';
import * as storeService from '../services/storeService.js';
import * as surveyLeadService from '../services/surveyLeadService.js';
import * as surveyWhatsappService from '../services/surveyWhatsappService.js';

export const adminRouter = Router();
const guard = [requireAuth, requireRole(...ROLES.admin)] as const;

adminRouter.get('/categories', ...guard, async (_req, res) => {
  res.json(envelope(await categoryService.list()));
});
adminRouter.post('/categories', ...guard, validateBody(categoryUpsertSchema), async (req, res) => {
  res.json(envelope(await categoryService.create(req.body)));
});
adminRouter.put('/categories/:id', ...guard, validateBody(categoryUpsertSchema), async (req, res) => {
  res.json(envelope(await categoryService.update(req.params.id as string, req.body)));
});
adminRouter.delete('/categories/:id', ...guard, async (req, res) => {
  await categoryService.remove(req.params.id as string);
  res.status(204).send();
});

// ---------- Sugestões de segmento/categoria ("Outro" no cadastro) ----------
adminRouter.get('/category-suggestions', ...guard, async (req, res) => {
  res.json(envelope(await categorySuggestionService.list(req.query.status as string | undefined)));
});
adminRouter.post('/category-suggestions/:id/approve', ...guard, async (req, res) => {
  res.json(envelope(await categorySuggestionService.approve(req.params.id as string, userId(req))));
});
adminRouter.post('/category-suggestions/:id/reject', ...guard, async (req, res) => {
  res.json(envelope(await categorySuggestionService.reject(req.params.id as string, userId(req))));
});

adminRouter.get('/integrations', ...guard, async (_req, res) => {
  res.json(envelope(await settingsService.getGroups()));
});
adminRouter.put('/integrations', ...guard, validateBody(updateSettingSchema), async (req, res) => {
  await settingsService.updateSetting(userId(req), req.body);
  res.json(envelope(await settingsService.getGroups()));
});

adminRouter.get('/metrics', ...guard, async (_req, res) => {
  res.json(envelope(await adminService.metrics()));
});

adminRouter.get('/sales', ...guard, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(
    envelope(
      await adminService.sales(
        q.partnerId,
        q.status,
        q.q,
        q.page ? Number(q.page) : 1,
        q.pageSize ? Number(q.pageSize) : 20,
      ),
    ),
  );
});

adminRouter.get('/partners', ...guard, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(envelope(await adminService.partners(q.page ? Number(q.page) : 1, q.pageSize ? Number(q.pageSize) : 20)));
});
adminRouter.post('/partners', ...guard, validateBody(partnerUpsertSchema), async (req, res) => {
  res.json(envelope(await adminService.createPartner(req.body)));
});
adminRouter.put('/partners/:id', ...guard, validateBody(partnerUpsertSchema), async (req, res) => {
  res.json(envelope(await adminService.updatePartner(req.params.id as string, req.body)));
});
adminRouter.delete('/partners/:id', ...guard, async (req, res) => {
  await adminService.deletePartner(req.params.id as string);
  res.status(204).send();
});

adminRouter.get('/payouts/summary', ...guard, async (_req, res) => {
  res.json(envelope(await adminService.payoutSummary()));
});
adminRouter.get('/payouts', ...guard, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(
    envelope(
      await adminService.payouts(q.partnerId, q.page ? Number(q.page) : 1, q.pageSize ? Number(q.pageSize) : 20),
    ),
  );
});
adminRouter.post('/payouts', ...guard, validateBody(createPayoutSchema), async (req, res) => {
  res.json(envelope(await adminService.createPayout(userId(req), req.body)));
});

adminRouter.get('/stores', ...guard, async (req, res) => {
  res.json(envelope(await storeService.listForAdmin(req.query.partnerId as string | undefined)));
});
adminRouter.post('/stores', ...guard, validateBody(storeUpsertSchema), async (req, res) => {
  res.json(envelope(await storeService.createForAdmin(req.body)));
});
adminRouter.put('/stores/:id', ...guard, validateBody(storeUpsertSchema), async (req, res) => {
  res.json(envelope(await storeService.updateForAdmin(req.params.id as string, req.body)));
});
adminRouter.delete('/stores/:id', ...guard, async (req, res) => {
  await storeService.deleteForAdmin(req.params.id as string);
  res.status(204).send();
});

adminRouter.get('/users', ...guard, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(envelope(await adminService.users(q.q, q.page ? Number(q.page) : 1, q.pageSize ? Number(q.pageSize) : 20)));
});
adminRouter.post('/users', ...guard, validateBody(adminUserCreateSchema), async (req, res) => {
  res.json(envelope(await adminService.createUser(req.body)));
});
adminRouter.put('/users/:id', ...guard, validateBody(adminUserUpdateSchema), async (req, res) => {
  res.json(envelope(await adminService.updateUser(req.params.id as string, req.body)));
});

adminRouter.get('/leads', ...guard, async (_req, res) => {
  res.json(envelope(await assistantService.listLeads()));
});

// ---------- Programa de afiliados ----------
adminRouter.get('/affiliate-applications', ...guard, async (req, res) => {
  res.json(envelope(await affiliateApplicationService.list(req.query.status as string | undefined)));
});
adminRouter.post('/affiliate-applications/:id/approve', ...guard, async (req, res) => {
  res.json(envelope(await affiliateApplicationService.approve(req.params.id as string, userId(req))));
});
adminRouter.post('/affiliate-applications/:id/reject', ...guard, async (req, res) => {
  res.json(envelope(await affiliateApplicationService.reject(req.params.id as string, userId(req))));
});

adminRouter.get('/campaign-materials', ...guard, async (_req, res) => {
  res.json(envelope(await campaignMaterialService.listAll()));
});
adminRouter.post('/campaign-materials', ...guard, validateBody(campaignMaterialSchema), async (req, res) => {
  res.json(envelope(await campaignMaterialService.create(req.body)));
});
adminRouter.put('/campaign-materials/:id', ...guard, validateBody(campaignMaterialSchema), async (req, res) => {
  res.json(envelope(await campaignMaterialService.update(req.params.id as string, req.body)));
});
adminRouter.delete('/campaign-materials/:id', ...guard, async (req, res) => {
  await campaignMaterialService.remove(req.params.id as string);
  res.status(204).send();
});

// ---------- Chaves de API de serviço (n8n, energia-solar-api, ...) ----------
adminRouter.get('/service-api-keys', ...guard, async (_req, res) => {
  res.json(envelope(await serviceApiKeyService.list()));
});
adminRouter.post('/service-api-keys', ...guard, validateBody(createApiKeySchema), async (req, res) => {
  const { key, dto } = await serviceApiKeyService.create(req.body);
  // A chave em texto puro só existe nesta resposta — nunca mais é recuperável.
  res.json(envelope({ ...dto, key }));
});
adminRouter.delete('/service-api-keys/:id', ...guard, async (req, res) => {
  await serviceApiKeyService.revoke(req.params.id as string);
  res.status(204).send();
});

// ---------- Pesquisa de opinião (link pessoal do motorista) ----------
adminRouter.get('/survey/leads', ...guard, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(envelope(await surveyLeadService.listLeads(q.page ? Number(q.page) : 1, q.pageSize ? Number(q.pageSize) : 20)));
});
adminRouter.post('/survey/whatsapp', ...guard, async (_req, res) => {
  res.json(envelope(await surveyWhatsappService.connect()));
});
adminRouter.get('/survey/whatsapp', ...guard, async (_req, res) => {
  res.json(envelope(await surveyWhatsappService.status()));
});
adminRouter.delete('/survey/whatsapp', ...guard, async (_req, res) => {
  await surveyWhatsappService.disconnect();
  res.status(204).send();
});

adminRouter.get('/audit-logs', ...guard, async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(
    envelope(
      await adminService.auditLogs(
        q.from ? new Date(q.from) : undefined,
        q.to ? new Date(q.to) : undefined,
        q.userId,
        q.action,
        q.page ? Number(q.page) : 1,
        q.pageSize ? Number(q.pageSize) : 20,
      ),
    ),
  );
});
