import type {
  CatalogFiltersDto,
  CatalogPage,
  CatalogQuery,
  NearbyStoreDto,
  PartnerDto,
  ProductDto,
  StoreDto,
} from '../dtos/catalog.dto.js';
import { distanceKm } from '../domain/geoUtils.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { parseCategoryType, toPartnerDto, toProductDto, toStoreDto } from '../mappings.js';
import type { CategoryDto } from '../dtos/catalog.dto.js';
import { toCategoryDto } from '../mappings.js';

type StoreLocationMap = Map<string, { cities: string[]; states: string[] }>;

/** Mapa parceiro → (cidades, estados) das lojas físicas. */
async function storeMap(): Promise<StoreLocationMap> {
  const stores = await prisma.partnerStore.findMany({
    where: { OR: [{ city: { not: '' } }, { state: { not: '' } }] },
  });
  const map: StoreLocationMap = new Map();
  for (const s of stores) {
    const entry = map.get(s.partnerId) ?? { cities: [], states: [] };
    if (s.city && !entry.cities.includes(s.city)) entry.cities.push(s.city);
    if (s.state && !entry.states.includes(s.state)) entry.states.push(s.state);
    map.set(s.partnerId, entry);
  }
  for (const entry of map.values()) {
    entry.cities.sort();
    entry.states.sort();
  }
  return map;
}

function mapProduct(p: Parameters<typeof toProductDto>[0], map: StoreLocationMap): ProductDto {
  if (p.kind === 'Digital') return toProductDto(p);
  const loc = map.get(p.partnerId) ?? { cities: [], states: [] };
  return toProductDto(p, loc.cities, loc.states);
}

export async function getProducts(category?: string, q?: string, partnerId?: string): Promise<ProductDto[]> {
  const list = await prisma.product.findMany({
    where: {
      active: true,
      partner: { active: true },
      ...(category && category !== 'Todos' ? { category } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(partnerId ? { partnerId } : {}),
    },
    include: { partner: true },
    orderBy: { title: 'asc' },
  });
  const map = await storeMap();
  return list.map((p) => mapProduct(p, map));
}

export async function searchCatalog(q: CatalogQuery): Promise<CatalogPage> {
  const term = q.q?.trim();
  let products = await prisma.product.findMany({
    where: {
      active: true,
      partner: { active: true },
      ...(q.category && q.category !== 'Todos' ? { category: q.category } : {}),
      ...(q.partnerId ? { partnerId: q.partnerId } : {}),
      ...(term
        ? {
            OR: [
              { title: { contains: term, mode: 'insensitive' } },
              { description: { contains: term, mode: 'insensitive' } },
              { partner: { name: { contains: term, mode: 'insensitive' } } },
              {
                partner: {
                  stores: {
                    some: {
                      OR: [
                        { name: { contains: term, mode: 'insensitive' } },
                        { address: { contains: term, mode: 'insensitive' } },
                        { city: { contains: term, mode: 'insensitive' } },
                        { state: { contains: term, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(q.minPrice != null ? { price: { gte: q.minPrice } } : {}),
      ...(q.maxPrice != null ? { price: { lte: q.maxPrice } } : {}),
    },
    include: { partner: true },
  });

  const map = await storeMap();

  // Filtro de localização: digital aparece sempre; físico precisa de loja na
  // cidade/estado pedidos.
  if (q.city) {
    products = products.filter(
      (p) =>
        p.kind === 'Digital' ||
        (map.get(p.partnerId)?.cities ?? []).some((c) => c.toLowerCase() === q.city!.toLowerCase()),
    );
  }
  if (q.state) {
    products = products.filter(
      (p) =>
        p.kind === 'Digital' ||
        (map.get(p.partnerId)?.states ?? []).some((s) => s.toLowerCase() === q.state!.toLowerCase()),
    );
  }

  const dtos = products.map((p) => mapProduct(p, map));
  switch (q.sort ?? 'relevance') {
    case 'price_asc':
      dtos.sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      dtos.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      dtos.sort((a, b) => b.rating - a.rating);
      break;
    default:
      dtos.sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));
  }

  const total = dtos.length;
  const pageSize = Math.min(50, Math.max(20, q.pageSize <= 0 ? 20 : q.pageSize));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, q.page <= 0 ? 1 : q.page));
  const items = dtos.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  return { items, total, page, pageSize, totalPages };
}

export async function getFilters(): Promise<CatalogFiltersDto> {
  const cats = await prisma.category.findMany({
    where: { active: true, type: 'Product' },
    orderBy: { name: 'asc' },
    select: { name: true },
  });
  const stores = await prisma.partnerStore.findMany({ select: { city: true, state: true } });
  const cities = [...new Set(stores.map((s) => s.city).filter(Boolean))].sort();
  const states = [...new Set(stores.map((s) => s.state).filter(Boolean))].sort();
  const prices = await prisma.product.findMany({ where: { active: true }, select: { price: true } });
  const nums = prices.map((p) => p.price.toNumber());
  const minP = nums.length > 0 ? Math.min(...nums) : 0;
  const maxP = nums.length > 0 ? Math.max(...nums) : 0;
  return {
    categories: cats.map((c) => c.name),
    cities,
    states,
    minPrice: Math.floor(minP),
    maxPrice: Math.ceil(maxP),
  };
}

export async function getActiveCategories(type: string): Promise<CategoryDto[]> {
  const t = parseCategoryType(type);
  const rows = await prisma.category.findMany({ where: { active: true, type: t }, orderBy: { name: 'asc' } });
  return rows.map(toCategoryDto);
}

export async function getProduct(id: string): Promise<ProductDto> {
  const p = await prisma.product.findUnique({ where: { id }, include: { partner: true } });
  if (!p) throw new AppError('Produto não encontrado.', 404);
  const map = await storeMap();
  return mapProduct(p, map);
}

export async function getStores(partnerId?: string): Promise<StoreDto[]> {
  const list = await prisma.partnerStore.findMany({
    where: {
      lat: { gte: -90, lte: 90 },
      lng: { gte: -180, lte: 180 },
      NOT: { lat: 0, lng: 0 },
      ...(partnerId ? { partnerId } : {}),
    },
  });
  return list.map(toStoreDto);
}

export async function getNearbyStores(lat: number, lng: number, radiusKm: number, limit: number): Promise<NearbyStoreDto[]> {
  const stores = await prisma.partnerStore.findMany({
    where: { lat: { gte: -90, lte: 90 }, lng: { gte: -180, lte: 180 }, NOT: { lat: 0, lng: 0 } },
  });
  return stores
    .map((s) => ({ ...toStoreDto(s), distanceKm: distanceKm(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

export async function getPartners(): Promise<PartnerDto[]> {
  const list = await prisma.partner.findMany();
  return list.map(toPartnerDto);
}

export async function getPartner(id: string): Promise<PartnerDto> {
  const p = await prisma.partner.findUnique({ where: { id } });
  if (!p) throw new AppError('Parceiro não encontrado.', 404);
  return toPartnerDto(p);
}
