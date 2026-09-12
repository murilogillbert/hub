import type {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  NotificationDto,
  PartnerRegisterRequest,
  RegisterRequest,
  UpdateNotificationsRequest,
  UpdateProfileRequest,
  UserDto,
} from '../dtos/auth.dto.js';
import { AppError } from '../errors.js';
import { hashPassword, verifyPassword } from '../infra/auth/passwordHasher.js';
import { issueTokens, validateRefreshToken } from '../infra/auth/jwt.js';
import { prisma } from '../infra/prisma.js';
import { toNotificationDto, toUserDto } from '../mappings.js';

function dicebearAvatar(seed: string, style: 'avataaars' | 'icons' = 'avataaars', extra = ''): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}${extra}`;
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
      role: 'Client',
      phone: req.phone,
      avatarUrl: dicebearAvatar(req.name),
    },
  });
  return build(user);
}

export async function registerPartner(req: PartnerRegisterRequest): Promise<AuthResponse> {
  const email = req.email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new AppError('E-mail já cadastrado.', 409);

  const user = await prisma.$transaction(async (tx) => {
    const partner = await tx.partner.create({
      data: {
        name: req.storeName.trim(),
        segment: req.segment.trim(),
        feePercent: 10,
        active: true,
        cnpj: (req.cnpj ?? '').trim(),
        city: (req.city ?? '').trim(),
        state: (req.state ?? '').trim(),
        lat: req.lat ?? 0,
        lng: req.lng ?? 0,
        logoUrl: dicebearAvatar(req.storeName, 'icons', '&backgroundType=gradientLinear'),
      },
    });

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
  if (!user) throw new AppError('Usuário não encontrado.', 401);
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
  if (!req.newPassword || req.newPassword.length < 6)
    throw new AppError('A nova senha deve ter pelo menos 6 caracteres.', 400);
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
