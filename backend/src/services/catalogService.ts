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
import {
  parseCategoryType,
  toPartnerDto,
  toProductDto,
  toStoreDto,
  type DisponibilidadePorUnidade,
} from '../mappings.js';
import type { CategoryDto } from '../dtos/catalog.dto.js';
import { toCategoryDto } from '../mappings.js';
import * as productStoreStockService from './productStoreStockService.js';

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

type DisponibilidadeMap = Map<string, DisponibilidadePorUnidade>;

/**
 * Disponibilidade por unidade dos produtos informados, em **uma** consulta.
 *
 * Uma consulta e não uma por produto: este é o caminho mais quente do hub, e um `include` no
 * modelo deixaria toda leitura de produto mais caro — inclusive as que não usam o dado.
 *
 * O resultado distingue dois casos que parecem iguais de fora:
 *
 *   sem nenhuma linha               →  `declared: false`. Disponível em todas as unidades do
 *                                      parceiro. É o comportamento de hoje, e o acervo inteiro
 *                                      está assim.
 *   com linhas, nenhuma disponível  →  `declared: true`, `stores: []`. Esgotado em todas.
 *
 * Sem essa distinção, o deploy desta frente sumiria com o catálogo inteiro: todo produto
 * passaria a "não disponível em unidade nenhuma".
 */
async function disponibilidadeMap(productIds: string[]): Promise<DisponibilidadeMap> {
  // A regra mora em `productStoreStockService`, para a lista do catálogo e a lista do próprio
  // lojista responderem a mesma coisa. Enquanto era privada daqui, `partnerService.myProducts`
  // não tinha acesso e a tela de gestão dizia "todas as unidades" para produto restrito a uma.
  return productStoreStockService.disponibilidadePorProduto(productIds);
}

/**
 * Unidades do parceiro que estão **abertas agora**, para o filtro de "aberto agora".
 *
 * Devolve também o conjunto de todas as unidades por parceiro, porque produto sem estoque por
 * unidade declarado está disponível em todas — e aí a pergunta "tem alguma aberta?" se responde
 * sobre esse conjunto, não sobre uma lista vazia.
 */
async function unidadesAbertas(agora: Date): Promise<{
  abertas: Set<string>;
  doParceiro: Map<string, string[]>;
}> {
  const stores = await prisma.partnerStore.findMany();
  const abertas = new Set<string>();
  const doParceiro = new Map<string, string[]>();
  for (const s of stores) {
    const dto = toStoreDto(s, agora);
    if (dto.openNow) abertas.add(s.id);
    doParceiro.set(s.partnerId, [...(doParceiro.get(s.partnerId) ?? []), s.id]);
  }
  return { abertas, doParceiro };
}

function mapProduct(
  p: Parameters<typeof toProductDto>[0],
  map: StoreLocationMap,
  disp?: DisponibilidadeMap
): ProductDto {
  const d = disp?.get(p.id);
  if (p.kind === 'Digital') return toProductDto(p, [], [], d);
  const loc = map.get(p.partnerId) ?? { cities: [], states: [] };
  return toProductDto(p, loc.cities, loc.states, d);
}

/**
 * As unidades em que este produto pode ser retirado.
 *
 * Produto sem estoque por unidade declarado cai para **todas** as unidades do parceiro — ver a
 * nota de `disponibilidadeMap`.
 */
function unidadesDoProduto(
  produto: { id: string; partnerId: string },
  disp: DisponibilidadeMap,
  doParceiro: Map<string, string[]>
): string[] {
  const d = disp.get(produto.id);
  if (!d?.declared) return doParceiro.get(produto.partnerId) ?? [];
  return d.stores;
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
  const [map, disp] = await Promise.all([
    storeMap(),
    disponibilidadeMap(list.map((p) => p.id)),
  ]);
  return list.map((p) => mapProduct(p, map, disp));
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

  const agora = new Date();
  const precisaDeUnidade = Boolean(q.storeId) || q.openNow === true;
  const [map, disp, unidades] = await Promise.all([
    storeMap(),
    disponibilidadeMap(products.map((p) => p.id)),
    precisaDeUnidade
      ? unidadesAbertas(agora)
      : Promise.resolve({ abertas: new Set<string>(), doParceiro: new Map<string, string[]>() }),
  ]);

  /**
   * Filtro por unidade: "o que posso retirar nesta loja".
   *
   * Produto digital **não** é filtrado por unidade — não se retira em loja nenhuma, e excluí-lo
   * daria "nada disponível" numa loja que vende cartão-presente.
   */
  if (q.storeId) {
    products = products.filter(
      (p) =>
        p.kind === 'Digital' ||
        unidadesDoProduto(p, disp, unidades.doParceiro).includes(q.storeId!),
    );
  }

  /** Aberto agora: ao menos uma das unidades onde o produto existe tem de estar aberta. */
  if (q.openNow === true) {
    products = products.filter(
      (p) =>
        p.kind === 'Digital' ||
        unidadesDoProduto(p, disp, unidades.doParceiro).some((id) => unidades.abertas.has(id)),
    );
  }

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

  const dtos = products.map((p) => mapProduct(p, map, disp));
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
  const [map, disp] = await Promise.all([storeMap(), disponibilidadeMap([p.id])]);
  return mapProduct(p, map, disp);
}

/**
 * Unidades no mapa público.
 *
 * `active: true` no filtro: unidade desativada é uma loja em reforma ou de férias, e mandar
 * cliente para uma porta fechada é pior do que não mostrá-la. Hoje a coluna nasce `true` em
 * todas as linhas, então isto não muda nada no acervo — passa a valer quando alguém desativar.
 */
export async function getStores(partnerId?: string, openNow?: boolean): Promise<StoreDto[]> {
  const list = await prisma.partnerStore.findMany({
    where: {
      active: true,
      lat: { gte: -90, lte: 90 },
      lng: { gte: -180, lte: 180 },
      NOT: { lat: 0, lng: 0 },
      ...(partnerId ? { partnerId } : {}),
    },
  });
  /**
   * O relógio é lido **uma vez** para o lote inteiro.
   *
   * `new Date()` dentro do `map` daria instantes diferentes para unidades diferentes na mesma
   * resposta, e na virada do minuto duas lojas com o mesmo horário apareceriam com estados
   * diferentes.
   */
  const agora = new Date();
  const dtos = list.map((s) => toStoreDto(s, agora));
  return openNow === true ? dtos.filter((s) => s.openNow) : dtos;
}

export async function getNearbyStores(
  lat: number,
  lng: number,
  radiusKm: number,
  limit: number,
  openNow?: boolean,
): Promise<NearbyStoreDto[]> {
  const stores = await prisma.partnerStore.findMany({
    where: {
      active: true,
      lat: { gte: -90, lte: 90 },
      lng: { gte: -180, lte: 180 },
      NOT: { lat: 0, lng: 0 },
    },
  });
  const agora = new Date();
  return stores
    .map((s) => ({ ...toStoreDto(s, agora), distanceKm: distanceKm(lat, lng, s.lat, s.lng) }))
    .filter((s) => s.distanceKm <= radiusKm)
    .filter((s) => openNow !== true || s.openNow)
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
