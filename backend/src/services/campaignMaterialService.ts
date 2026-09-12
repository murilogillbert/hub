import type { CampaignMaterialDto, CampaignMaterialRequest } from '../dtos/affiliate.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';
import { toCampaignMaterialDto } from '../mappings.js';

export async function listActive(): Promise<CampaignMaterialDto[]> {
  const rows = await prisma.campaignMaterial.findMany({ where: { active: true }, orderBy: { createdAt: 'desc' } });
  return rows.map(toCampaignMaterialDto);
}

export async function listAll(): Promise<CampaignMaterialDto[]> {
  const rows = await prisma.campaignMaterial.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(toCampaignMaterialDto);
}

export async function create(req: CampaignMaterialRequest): Promise<CampaignMaterialDto> {
  const row = await prisma.campaignMaterial.create({
    data: { title: req.title.trim(), description: req.description.trim(), fileUrl: req.fileUrl, active: req.active },
  });
  return toCampaignMaterialDto(row);
}

export async function update(id: string, req: CampaignMaterialRequest): Promise<CampaignMaterialDto> {
  const existing = await prisma.campaignMaterial.findUnique({ where: { id } });
  if (!existing) throw new AppError('Material não encontrado.', 404);
  const row = await prisma.campaignMaterial.update({
    where: { id },
    data: { title: req.title.trim(), description: req.description.trim(), fileUrl: req.fileUrl, active: req.active },
  });
  return toCampaignMaterialDto(row);
}

export async function remove(id: string): Promise<void> {
  const existing = await prisma.campaignMaterial.findUnique({ where: { id } });
  if (!existing) throw new AppError('Material não encontrado.', 404);
  await prisma.campaignMaterial.update({ where: { id }, data: { active: false } });
}
