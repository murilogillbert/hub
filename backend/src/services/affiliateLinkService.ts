import type { AffiliateLookupDto, LinkEventRequest } from '../dtos/affiliate.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';

async function findActiveAffiliate(code: string) {
  const partner = await prisma.partner.findUnique({
    where: { referralCode: code },
    include: { users: { take: 1 } },
  });
  if (!partner || partner.kind !== 'SolarAffiliate') return null;
  return partner;
}

export async function lookup(code: string): Promise<AffiliateLookupDto> {
  const partner = await findActiveAffiliate(code);
  if (!partner) throw new AppError('Afiliado não encontrado.', 404);
  return {
    code,
    name: partner.name,
    active: partner.active,
    whatsappPhone: partner.users[0]?.phone ?? null,
    evolutionInstance: partner.evolutionInstance,
  };
}

/** Usado pelo redirect público (GET /r/:code) — não falha se o código não
 * existir, apenas não conta a visita (o redirect final acontece de qualquer jeito). */
export async function recordClick(code: string): Promise<void> {
  await prisma.partner.updateMany({
    where: { referralCode: code, kind: 'SolarAffiliate' },
    data: { linkViews: { increment: 1 } },
  });
}

export async function recordLinkEvent(code: string, req: LinkEventRequest): Promise<void> {
  const partner = await findActiveAffiliate(code);
  if (!partner) throw new AppError('Afiliado não encontrado.', 404);
  await prisma.partner.update({
    where: { id: partner.id },
    data: req.type === 'lead' ? { linkLeads: { increment: 1 } } : { linkSales: { increment: 1 } },
  });
}
