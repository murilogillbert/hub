import type { CategoryDto, CategoryUpsertRequest } from '../dtos/catalog.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { parseCategoryType, toCategoryDto } from '../mappings.js';

export async function list(): Promise<CategoryDto[]> {
  const rows = await prisma.category.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  return rows.map(toCategoryDto);
}

export async function create(req: CategoryUpsertRequest): Promise<CategoryDto> {
  const name = req.name.trim();
  if (!name) throw new AppError('Nome da categoria é obrigatório.', 400);
  const type = parseCategoryType(req.type);
  if (await prisma.category.findFirst({ where: { name, type } }))
    throw new AppError('Já existe uma categoria com esse nome.', 409);
  const cat = await prisma.category.create({ data: { name, type, active: req.active } });
  return toCategoryDto(cat);
}

export async function update(id: string, req: CategoryUpsertRequest): Promise<CategoryDto> {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new AppError('Categoria não encontrada.', 404);
  const name = req.name.trim();
  if (!name) throw new AppError('Nome da categoria é obrigatório.', 400);
  if (await prisma.category.findFirst({ where: { name, type: cat.type, id: { not: id } } }))
    throw new AppError('Já existe uma categoria com esse nome.', 409);

  const previousName = cat.name;
  const updated = await prisma.category.update({ where: { id }, data: { name, active: req.active } });
  if (previousName !== name) await propagateRename(cat.type, previousName, name);
  return toCategoryDto(updated);
}

export async function remove(id: string): Promise<void> {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new AppError('Categoria não encontrada.', 404);
  // Soft-delete: desativa para não quebrar produtos existentes.
  await prisma.category.update({ where: { id }, data: { active: false } });
}

async function propagateRename(type: 'Product' | 'Store', previousName: string, newName: string): Promise<void> {
  if (type === 'Product') {
    await prisma.product.updateMany({ where: { category: previousName }, data: { category: newName } });
    return;
  }
  await prisma.partner.updateMany({ where: { segment: previousName }, data: { segment: newName } });
  await prisma.partnerStore.updateMany({ where: { category: previousName }, data: { category: newName } });
}
