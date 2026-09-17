import type { ApplicationStatus } from '@prisma/client';
import type { CategorySuggestionDto } from '../dtos/catalog.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { toCategorySuggestionDto, tryParseApplicationStatus } from '../mappings.js';

export async function list(status?: string): Promise<CategorySuggestionDto[]> {
  const parsed = tryParseApplicationStatus(status);
  const rows = await prisma.categorySuggestion.findMany({
    where: parsed ? { status: parsed } : {},
    include: { partner: true },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toCategorySuggestionDto);
}

async function resolve(id: string, actorId: string, status: ApplicationStatus): Promise<CategorySuggestionDto> {
  const suggestion = await prisma.categorySuggestion.findUnique({ where: { id } });
  if (!suggestion) throw new AppError('Sugestão não encontrada.', 404);
  if (suggestion.status !== 'Pending') throw new AppError('Esta sugestão já foi avaliada.', 409);

  const updated = await prisma.categorySuggestion.update({
    where: { id },
    data: { status, resolvedAt: new Date(), resolvedBy: actorId },
    include: { partner: true },
  });
  return toCategorySuggestionDto(updated);
}

export async function reject(id: string, actorId: string): Promise<CategorySuggestionDto> {
  return resolve(id, actorId, 'Rejected');
}

/** Aprova: promove a sugestão a uma Category de verdade (ou reaproveita uma
 * já existente com o mesmo nome/tipo, caso outra sugestão já a tenha criado). */
export async function approve(id: string, actorId: string): Promise<CategorySuggestionDto> {
  const suggestion = await prisma.categorySuggestion.findUnique({ where: { id } });
  if (!suggestion) throw new AppError('Sugestão não encontrada.', 404);
  if (suggestion.status !== 'Pending') throw new AppError('Esta sugestão já foi avaliada.', 409);

  const existingCategory = await prisma.category.findFirst({
    where: { name: suggestion.name, type: suggestion.type },
  });
  if (!existingCategory) {
    await prisma.category.create({
      data: { name: suggestion.name, type: suggestion.type, active: true },
    });
  }

  const updated = await prisma.categorySuggestion.update({
    where: { id },
    data: { status: 'Approved', resolvedAt: new Date(), resolvedBy: actorId },
    include: { partner: true },
  });
  return toCategorySuggestionDto(updated);
}
