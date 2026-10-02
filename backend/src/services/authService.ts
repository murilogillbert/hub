import { isDeletedEmail } from '../infra/auth/accountStatus.js';
import type {
  AuthResponse,
  ChangePasswordRequest,
  DeleteAccountRequest,
  LoginRequest,
  NotificationDto,
  PartnerRegisterRequest,
  RegisterPushTokenRequest,
  RegisterRequest,
  UnregisterPushTokenRequest,
  UpdateNotificationsRequest,
  UpdateProfileRequest,
  UserDto,
} from '../dtos/auth.dto.js';
import { config } from '../config.js';
import { passwordProblem } from '../domain/password.js';
import { AppError } from '../errors.js';
import { opendriverDeletionBlockers, purgeOpendriverAccount } from '../infra/accountSync.js';
import { hashPassword, verifyPassword } from '../infra/auth/passwordHasher.js';
import * as accountPurgeService from './accountPurgeService.js';
import { issueTokens, validateRefreshToken } from '../infra/auth/jwt.js';
import { issueToken, consumeToken } from '../infra/auth/verificationTokens.js';
import { sendEmail } from '../infra/email/emailFacade.js';
import { prisma } from '../infra/prisma.js';
import { isValidPartnerDocument, toNotificationDto, toUserDto } from '../mappings.js';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

function dicebearAvatar(seed: string, style: 'avataaars' | 'icons' = 'avataaars', extra = ''): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}${extra}`;
}

/** Dispara o e-mail de verificação — nunca bloqueia o fluxo que a chamou
 * (mesmo padrão do e-mail de boas-vindas do afiliado). */
async function sendVerificationEmail(userId: string, name: string, email: string): Promise<void> {
  try {
    const rawToken = await issueToken(userId, 'EmailVerification', EMAIL_VERIFICATION_TTL_MS);
    const link = `${config.frontendUrl}/verificar-email?token=${encodeURIComponent(rawToken)}`;
    await sendEmail(
      email,
      'Confirme seu e-mail',
      `<p>Olá, ${name}!</p>
       <p>Confirme seu e-mail pra liberar pagamentos e saques na plataforma:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Esse link expira em 24 horas.</p>`,
    );
  } catch (err) {
    console.warn('Falha ao enviar e-mail de verificação', err);
  }
}

function build(user: Parameters<typeof toUserDto>[0]): AuthResponse {
  const { token, refreshToken } = issueTokens({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    partnerId: user.partnerId,
  });
  return { token, refreshToken, user: toUserDto(user) };
}

export async function register(req: RegisterRequest): Promise<AuthResponse> {
  const email = req.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError('E-mail já cadastrado.', 409);

  const user = await prisma.user.create({
    data: {
      name: req.name.trim(),
      email,
      passwordHash: hashPassword(req.password),
      role: req.role,
      phone: req.phone,
      cpf: req.cpf?.trim() || null,
      avatarUrl: dicebearAvatar(req.name),
    },
  });
  await sendVerificationEmail(user.id, user.name, user.email);
  return build(user);
}

export async function registerPartner(req: PartnerRegisterRequest): Promise<AuthResponse> {
  const email = req.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError('E-mail já cadastrado.', 409);

  const cnpj = (req.cnpj ?? '').trim();
  if (!isValidPartnerDocument(cnpj, req.documentType))
    throw new AppError(req.documentType === 'CPF' ? 'CPF inválido.' : 'CNPJ inválido.', 400);

  const segment = req.segment.trim();
  if (req.segmentIsSuggestion && !segment)
    throw new AppError('Descreva o segmento sugerido.', 400);

  const user = await prisma.$transaction(async (tx) => {
    const partner = await tx.partner.create({
      data: {
        name: req.storeName.trim(),
        segment,
        feePercent: 10,
        active: true,
        cnpj,
        documentType: req.documentType,
        city: (req.city ?? '').trim(),
        state: (req.state ?? '').trim(),
        lat: req.lat ?? 0,
        lng: req.lng ?? 0,
        logoUrl: dicebearAvatar(req.storeName, 'icons', '&backgroundType=gradientLinear'),
      },
    });

    // Segmento "Outro" — registra a sugestão pra avaliação do Admin, mas não
    // bloqueia o cadastro: a loja já nasce com o segmento sugerido preenchido.
    if (req.segmentIsSuggestion) {
      await tx.categorySuggestion.create({
        data: { name: segment, type: 'Store', partnerId: partner.id },
      });
    }

    return tx.user.create({
      data: {
        name: req.name.trim(),
        email,
        passwordHash: hashPassword(req.password),
        role: 'Partner',
        phone: req.phone,
        partnerId: partner.id,
        avatarUrl: dicebearAvatar(req.name),
      },
    });
  });

  await sendVerificationEmail(user.id, user.name, user.email);
  return build(user);
}

export async function login(req: LoginRequest): Promise<AuthResponse> {
  const email = req.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(req.password, user.passwordHash))
    throw new AppError('Credenciais inválidas.', 401);
  return build(user);
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  const userId = validateRefreshToken(refreshToken);
  if (!userId) throw new AppError('Refresh token inválido.', 401);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || isDeletedEmail(user.email)) throw new AppError('Usuário não encontrado.', 401);
  return build(user);
}

export async function me(userId: string): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  return toUserDto(user);
}

export async function updateProfile(userId: string, req: UpdateProfileRequest): Promise<UserDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      name: req.name.trim(),
      email: req.email.trim().toLowerCase(),
      phone: req.phone,
      ...(req.cpf?.trim() ? { cpf: req.cpf.trim() } : {}),
      ...(req.avatarUrl?.trim() ? { avatarUrl: req.avatarUrl.trim() } : {}),
    },
  });
  return toUserDto(updated);
}

export async function updateNotifications(userId: string, req: UpdateNotificationsRequest): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  await prisma.user.update({
    where: { id: userId },
    data: { notifyWhatsApp: req.whatsApp, notifyEmail: req.email, notifyPromo: req.promo },
  });
}

export async function changePassword(userId: string, req: ChangePasswordRequest): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  if (!verifyPassword(req.currentPassword, user.passwordHash))
    throw new AppError('Senha atual incorreta.', 400);
  // Mesma regra do cadastro e do OpenDriver (domain/password.ts) — contas antigas só são afetadas
  // quando a senha de fato muda.
  const problem = passwordProblem(req.newPassword ?? '');
  if (problem) throw new AppError(problem, 400);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(req.newPassword) } });
}

export async function notifications(userId: string): Promise<NotificationDto[]> {
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map(toNotificationDto);
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
}

/** Registra o aparelho para push. Um token pertence a UM usuário por vez (troca de conta no mesmo celular). */
export async function registerPushToken(userId: string, req: RegisterPushTokenRequest): Promise<void> {
  await prisma.pushToken.upsert({
    where: { token: req.token },
    create: { userId, token: req.token, platform: req.platform },
    update: { userId, platform: req.platform, lastSeen: new Date() },
  });
}

export async function removePushToken(userId: string, req: UnregisterPushTokenRequest): Promise<void> {
  await prisma.pushToken.deleteMany({ where: { token: req.token, userId } });
}

/**
 * Exclusão de conta pedida pela pessoa (App Store 5.1.1(v) / Google Play exigem o pedido dentro do
 * app). Orquestra os DOIS serviços, porque a conta é a mesma nos dois: `public.users` é
 * compartilhada, mas cada serviço é dono do seu schema e dos arquivos que subiu.
 *
 * A linha de `users` é **anonimizada**, não apagada: pedidos, extrato de cashback, comissões e
 * repasses apontam pra ela e precisam continuar íntegros para a contabilidade das lojas.
 *
 * Ordem deliberada:
 *  1. senha e papel conferidos aqui;
 *  2. impedimentos somados dos dois lados (pedido em aberto aqui, corrida em andamento lá) — se o
 *     OpenDriver não responder, a exclusão é recusada, nunca feita pela metade;
 *  3. OpenDriver apaga o lado dele (inclui foto de CNH, selfie e CRLV no storage);
 *  4. hub apaga o lado dele e anonimiza `users` por último.
 *
 * O passo 4 vem no fim porque os dois purges são idempotentes: se algo falhar no meio, a conta
 * continua viva e a pessoa pode repetir até concluir. O contrário — conta morta com dado pessoal
 * sobrando no outro schema — é o resultado que não pode acontecer.
 *
 * Contas de loja/equipe não se excluem sozinhas: têm repasse e obrigação fiscal em aberto.
 */
export async function deleteAccount(userId: string, req: DeleteAccountRequest): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  if (!verifyPassword(req.password, user.passwordHash)) throw new AppError('Senha incorreta.', 400);
  if (user.partnerId || user.role === 'Partner' || user.role === 'Admin' || user.role === 'Financeiro')
    throw new AppError('Contas de loja ou da equipe são encerradas pelo suporte.', 409);

  const blockers = [...(await accountPurgeService.deletionBlockers(userId)), ...(await opendriverDeletionBlockers(userId))];
  if (blockers.length) throw new AppError(`${blockers.join(' ')} Resolva antes de excluir a conta.`, 409);

  await purgeOpendriverAccount(userId);
  await accountPurgeService.purgeHubAccount(userId);
}

export async function resendVerification(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Não revela se o e-mail existe ou já está verificado — resposta genérica
  // pro chamador em ambos os casos, só dispara o e-mail quando faz sentido.
  if (user && !user.emailVerifiedAt) await sendVerificationEmail(user.id, user.name, user.email);
}

export async function confirmEmailVerification(token: string): Promise<void> {
  const userId = await consumeToken(token, 'EmailVerification');
  if (!userId) throw new AppError('Link inválido ou expirado.', 400);
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  // Mesma resposta pro chamador exista ou não a conta — evita enumeração de
  // e-mails cadastrados.
  if (!user) return;
  try {
    const rawToken = await issueToken(user.id, 'PasswordReset', PASSWORD_RESET_TTL_MS);
    const link = `${config.frontendUrl}/redefinir-senha?token=${encodeURIComponent(rawToken)}`;
    await sendEmail(
      user.email,
      'Redefinir sua senha',
      `<p>Olá, ${user.name}!</p>
       <p>Recebemos um pedido pra redefinir sua senha. Se foi você, clique no link abaixo:</p>
       <p><a href="${link}">${link}</a></p>
       <p>Esse link expira em 1 hora. Se não foi você, pode ignorar este e-mail.</p>`,
    );
  } catch (err) {
    console.warn('Falha ao enviar e-mail de redefinição de senha', err);
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const userId = await consumeToken(token, 'PasswordReset');
  if (!userId) throw new AppError('Link inválido ou expirado.', 400);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('Usuário não encontrado.', 404);
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: hashPassword(newPassword),
      // Provou controle da caixa de entrada — conta pra verificação de e-mail.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  });
}
