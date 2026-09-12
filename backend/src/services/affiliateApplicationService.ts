import crypto from 'node:crypto';
import type { AffiliateApplicationDto, AffiliateApplicationInput } from '../dtos/affiliate.dto.js';
import type { ApplicationStatus } from '@prisma/client';
import { AppError } from '../errors.js';
import { hashPassword } from '../infra/auth/passwordHasher.js';
import { sendEmail } from '../infra/email/emailFacade.js';
import { prisma } from '../infra/prisma.js';
import { toAffiliateApplicationDto, tryParseApplicationStatus } from '../mappings.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferralCode(): string {
  let out = '';
  for (let i = 0; i < 7; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

function generateTempPassword(): string {
  return crypto.randomBytes(9).toString('base64url');
}

export async function apply(req: AffiliateApplicationInput): Promise<AffiliateApplicationDto> {
  const app = await prisma.affiliateApplication.create({
    data: {
      name: req.name.trim(),
      email: req.email.trim().toLowerCase(),
      phone: req.phone.trim(),
      city: req.city.trim(),
      state: req.state.trim(),
      message: req.message.trim(),
    },
  });
  return toAffiliateApplicationDto(app);
}

export async function list(status?: string): Promise<AffiliateApplicationDto[]> {
  const parsed = tryParseApplicationStatus(status);
  const rows = await prisma.affiliateApplication.findMany({
    where: parsed ? { status: parsed } : {},
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toAffiliateApplicationDto);
}

async function resolve(id: string, actorId: string, status: ApplicationStatus): Promise<AffiliateApplicationDto> {
  const app = await prisma.affiliateApplication.findUnique({ where: { id } });
  if (!app) throw new AppError('Inscrição não encontrada.', 404);
  if (app.status !== 'Pending') throw new AppError('Esta inscrição já foi avaliada.', 409);

  const updated = await prisma.affiliateApplication.update({
    where: { id },
    data: { status, resolvedAt: new Date(), resolvedBy: actorId },
  });
  return toAffiliateApplicationDto(updated);
}

export async function reject(id: string, actorId: string): Promise<AffiliateApplicationDto> {
  return resolve(id, actorId, 'Rejected');
}

/** Aprova: cria User(role=Partner) + Partner(kind=SolarAffiliate) numa
 * transação, e envia e-mail de boas-vindas com a senha temporária. */
export async function approve(id: string, actorId: string): Promise<AffiliateApplicationDto> {
  const app = await prisma.affiliateApplication.findUnique({ where: { id } });
  if (!app) throw new AppError('Inscrição não encontrada.', 404);
  if (app.status !== 'Pending') throw new AppError('Esta inscrição já foi avaliada.', 409);

  if (await prisma.user.findUnique({ where: { email: app.email } }))
    throw new AppError('Já existe uma conta com este e-mail.', 409);

  const tempPassword = generateTempPassword();
  let referralCode = generateReferralCode();
  while (await prisma.partner.findUnique({ where: { referralCode } })) referralCode = generateReferralCode();

  const updated = await prisma.$transaction(async (tx) => {
    const partner = await tx.partner.create({
      data: {
        name: app.name,
        segment: 'Afiliado Solar',
        kind: 'SolarAffiliate',
        referralCode,
        active: true,
        city: app.city,
        state: app.state,
        logoUrl: `https://api.dicebear.com/9.x/icons/svg?seed=${encodeURIComponent(app.name)}`,
      },
    });
    await tx.user.create({
      data: {
        name: app.name,
        email: app.email,
        passwordHash: hashPassword(tempPassword),
        role: 'Partner',
        phone: app.phone || null,
        partnerId: partner.id,
        avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(app.name)}`,
      },
    });
    return tx.affiliateApplication.update({
      where: { id },
      data: { status: 'Approved', resolvedAt: new Date(), resolvedBy: actorId },
    });
  });

  try {
    await sendEmail(
      app.email,
      'Bem-vindo(a) ao programa de afiliados',
      `<p>Olá, ${app.name}!</p>
       <p>Sua inscrição como afiliado foi aprovada. Acesse a plataforma com:</p>
       <p><strong>E-mail:</strong> ${app.email}<br/>
          <strong>Senha temporária:</strong> ${tempPassword}</p>
       <p>Recomendamos trocar a senha no primeiro acesso.</p>`,
    );
  } catch (err) {
    // Aprovação já foi persistida; falha no e-mail não deve derrubar a
    // requisição — o admin pode reenviar as credenciais manualmente depois.
    console.warn('Falha ao enviar e-mail de boas-vindas ao afiliado', err);
  }

  return toAffiliateApplicationDto(updated);
}
