import { Router } from 'express';
import { envelope } from '../dtos/common.dto.js';
import { AppError } from '../errors.js';
import * as catalogService from '../services/catalogService.js';
import * as reviewService from '../services/reviewService.js';

export const catalogRouter = Router();

catalogRouter.get('/products', async (req, res) => {
  const { category, q, partnerId } = req.query as Record<string, string | undefined>;
  res.json(envelope(await catalogService.getProducts(category, q, partnerId)));
});

catalogRouter.get('/products/:id', async (req, res) => {
  res.json(envelope(await catalogService.getProduct(req.params.id)));
});

catalogRouter.get('/products/:id/reviews', async (req, res) => {
  res.json(envelope(await reviewService.listForProduct(req.params.id)));
});

catalogRouter.get('/catalog', async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  res.json(
    envelope(
      await catalogService.searchCatalog({
        category: q.category,
        q: q.q,
        city: q.city,
        state: q.state,
        partnerId: q.partnerId,
        minPrice: q.minPrice !== undefined ? Number(q.minPrice) : undefined,
        maxPrice: q.maxPrice !== undefined ? Number(q.maxPrice) : undefined,
        sort: q.sort,
        page: q.page !== undefined ? Number(q.page) : 1,
        pageSize: q.pageSize !== undefined ? Number(q.pageSize) : 20,
      }),
    ),
  );
});

catalogRouter.get('/catalog/filters', async (_req, res) => {
  res.json(envelope(await catalogService.getFilters()));
});

catalogRouter.get('/categories', async (req, res) => {
  const type = (req.query.type as string | undefined) ?? 'product';
  res.json(envelope(await catalogService.getActiveCategories(type)));
});

catalogRouter.get('/stores', async (req, res) => {
  res.json(envelope(await catalogService.getStores(req.query.partnerId as string | undefined)));
});

catalogRouter.get('/stores/nearby', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) throw new AppError('Coordenadas inválidas.', 400);
  const radiusKm = Math.min(50, Math.max(0.5, req.query.radiusKm !== undefined ? Number(req.query.radiusKm) : 10));
  const limit = Math.min(50, Math.max(1, req.query.limit !== undefined ? Number(req.query.limit) : 20));
  res.json(envelope(await catalogService.getNearbyStores(lat, lng, radiusKm, limit)));
});

catalogRouter.get('/partners', async (_req, res) => {
  res.json(envelope(await catalogService.getPartners()));
});

catalogRouter.get('/partners/:id', async (req, res) => {
  res.json(envelope(await catalogService.getPartner(req.params.id)));
});
