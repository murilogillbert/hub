import type { CreateApiKeyRequest, ServiceApiKeyDto } from '../dtos/affiliate.dto.js';
import { AppError } from '../errors.js';
import { generateApiKey } from '../infra/auth/apiKey.js';
import { prisma } from '../infra/prisma.js';
import { toServiceApiKeyDto } from '../mappings.js';

export async function list(): Promise<ServiceApiKeyDto[]> {
  const rows = await prisma.serviceApiKey.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toServiceApiKeyDto);
}

/** Retorna a chave em texto puro só nesta resposta — nunca mais é recuperável. */
export async function create(req: CreateApiKeyRequest): Promise<{ key: string; dto: ServiceApiKeyDto }> {
  const { key, hashedKey, keyPreview } = generateApiKey();
  const row = await prisma.serviceApiKey.create({
    data: { label: req.label, hashedKey, keyPreview, scopes: req.scopes },
  });
  return { key, dto: toServiceApiKeyDto(row) };
}

export async function revoke(id: string): Promise<void> {
  const row = await prisma.serviceApiKey.findUnique({ where: { id } });
  if (!row) throw new AppError('Chave não encontrada.', 404);
  await prisma.serviceApiKey.update({ where: { id }, data: { active: false } });
}
