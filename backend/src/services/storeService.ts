import type { StoreDto, StoreUpsertRequest } from '../dtos/catalog.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { toStoreDto } from '../mappings.js';

function validated(req: StoreUpsertRequest) {
  const name = req.name.trim();
  const address = req.address.trim();
  const city = req.city.trim();
  const state = req.state.trim().toUpperCase();
  const category = req.category.trim();

  if (!name) throw new AppError('Nome da unidade é obrigatório.', 400);
  if (!address) throw new AppError('Endereço é obrigatório.', 400);
  if (!city) throw new AppError('Cidade é obrigatória.', 400);
  if (!state) throw new AppError('Estado é obrigatório.', 400);
  if (!category) throw new AppError('Categoria é obrigatória.', 400);
  if (req.lat < -90 || req.lat > 90 || req.lng < -180 || req.lng > 180)
    throw new AppError('Coordenadas inválidas.', 400);
  if (req.lat === 0 && req.lng === 0)
    throw new AppError('Informe latitude e longitude reais da unidade.', 400);

  return { name, address, city, state, category, lat: req.lat, lng: req.lng, imageUrl: (req.imageUrl ?? '').trim() };
}

async function ensurePartner(partnerId: string): Promise<void> {
  if (!(await prisma.partner.findUnique({ where: { id: partnerId } })))
    throw new AppError('Parceiro não encontrado.', 404);
}

export async function listForAdmin(partnerId?: string): Promise<StoreDto[]> {
  const rows = await prisma.partnerStore.findMany({
    where: partnerId ? { partnerId } : {},
    orderBy: { name: 'asc' },
  });
  return rows.map(toStoreDto);
}

export async function listForPartner(partnerId: string): Promise<StoreDto[]> {
  const rows = await prisma.partnerStore.findMany({ where: { partnerId }, orderBy: { name: 'asc' } });
  return rows.map(toStoreDto);
}

export async function createForAdmin(req: StoreUpsertRequest): Promise<StoreDto> {
  if (!req.partnerId) throw new AppError('Parceiro é obrigatório.', 400);
  await ensurePartner(req.partnerId);
  const data = validated(req);
  const store = await prisma.partnerStore.create({ data: { ...data, partnerId: req.partnerId } });
  return toStoreDto(store);
}

export async function createForPartner(partnerId: string, req: StoreUpsertRequest): Promise<StoreDto> {
  await ensurePartner(partnerId);
  const data = validated(req);
  const store = await prisma.partnerStore.create({ data: { ...data, partnerId } });
  return toStoreDto(store);
}

export async function updateForAdmin(id: string, req: StoreUpsertRequest): Promise<StoreDto> {
  const store = await prisma.partnerStore.findUnique({ where: { id } });
  if (!store) throw new AppError('Unidade não encontrada.', 404);
  if (req.partnerId && req.partnerId !== store.partnerId) await ensurePartner(req.partnerId);
  const data = validated(req);
  const updated = await prisma.partnerStore.update({
    where: { id },
    data: { ...data, ...(req.partnerId && req.partnerId !== store.partnerId ? { partnerId: req.partnerId } : {}) },
  });
  return toStoreDto(updated);
}

export async function updateForPartner(partnerId: string, id: string, req: StoreUpsertRequest): Promise<StoreDto> {
  const store = await prisma.partnerStore.findFirst({ where: { id, partnerId } });
  if (!store) throw new AppError('Unidade não encontrada.', 404);
  const data = validated(req);
  const updated = await prisma.partnerStore.update({ where: { id }, data });
  return toStoreDto(updated);
}

export async function deleteForAdmin(id: string): Promise<void> {
  const store = await prisma.partnerStore.findUnique({ where: { id } });
  if (!store) throw new AppError('Unidade não encontrada.', 404);
  await prisma.partnerStore.delete({ where: { id } });
}

export async function deleteForPartner(partnerId: string, id: string): Promise<void> {
  const store = await prisma.partnerStore.findFirst({ where: { id, partnerId } });
  if (!store) throw new AppError('Unidade não encontrada.', 404);
  await prisma.partnerStore.delete({ where: { id } });
}
