import type { SurveyLinkDto } from '../dtos/survey.dto.js';
import { AppError } from '../errors.js';
import { prisma } from '../infra/prisma.js';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateSurveyCode(): string {
  let out = '';
  for (let i = 0; i < 7; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

/** Link pessoal do motorista pra pesquisa de opinião — code gerado lazily no
 * primeiro acesso (mesmo padrão de generateReferralCode em
 * affiliateApplicationService.ts, só que por User em vez de Partner). */
export async function myLink(userId: string): Promise<SurveyLinkDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado.', 404);

  let code = user.surveyCode;
  if (!code) {
    code = generateSurveyCode();
    while (await prisma.user.findUnique({ where: { surveyCode: code } })) code = generateSurveyCode();
    await prisma.user.update({ where: { id: userId }, data: { surveyCode: code } });
  }

  return {
    code,
    views: user.surveyLinkViews,
    responses: user.surveyLinkResponses,
    leads: user.surveyLinkLeads,
  };
}

/** Usado pelo redirect público (GET /r/pesquisa/:code) — não falha se o
 * código não existir, só não conta a visita (o redirect final acontece de
 * qualquer jeito). */
export async function recordClick(code: string): Promise<void> {
  await prisma.user.updateMany({
    where: { surveyCode: code },
    data: { surveyLinkViews: { increment: 1 } },
  });
}
