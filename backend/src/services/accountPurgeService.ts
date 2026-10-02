import { randomUUID } from 'node:crypto';
import { clearAccountStatusCache, DELETED_EMAIL_SUFFIX } from '../infra/auth/accountStatus.js';
import { hashPassword } from '../infra/auth/passwordHasher.js';
import { prisma } from '../infra/prisma.js';

/**
 * Exclusão de conta — a parte que pertence ao schema do hub.
 *
 * Separado de `authService.deleteAccount` porque roda em dois contextos: quando a pessoa pede pelo
 * app/site do hub, e quando o OpenDriver pede via `/internal/accounts/:id/purge` (pessoa excluiu a
 * conta pelo app de corridas). Nos dois casos o efeito tem de ser o mesmo.
 */

/** Motivos que impedem a exclusão agora, do lado do hub. Vazio = pode excluir. */
export async function deletionBlockers(userId: string): Promise<string[]> {
  const blockers: string[] = [];
  const pending = await prisma.order.count({ where: { customerId: userId, status: { in: ['PendingPayment', 'Paid'] } } });
  if (pending > 0) blockers.push('Você tem pedidos pendentes ou vouchers comprados e não resgatados no OpenDriverHub.');
  return blockers;
}

/**
 * Apaga os dados pessoais do schema do hub. **Idempotente**: pode rodar de novo numa conta já
 * anonimizada sem efeito colateral, o que é o que permite reexecutar a exclusão quando uma das
 * pontas falha no meio.
 *
 * Pedidos, extrato de cashback, comissões e repasses NÃO são apagados: as lojas parceiras precisam
 * deles para a contabilidade das vendas, e já não contêm dado pessoal depois da anonimização.
 */
export async function purgeHubAccount(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        name: 'Conta excluída',
        // Já anonimizada: mantém o e-mail atual para não gerar um endereço novo a cada chamada.
        email: user.email.endsWith(DELETED_EMAIL_SUFFIX) ? user.email : `excluido+${userId}${DELETED_EMAIL_SUFFIX}`,
        passwordHash: hashPassword(randomUUID()),
        phone: null,
        cpf: null,
        avatarUrl: null,
        emailVerifiedAt: null,
        notifyWhatsApp: false,
        notifyEmail: false,
        notifyPromo: false,
      },
    }),
    // Acesso: nenhum token de verificação/redefinição pendente continua utilizável.
    prisma.authToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.pushToken.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
  ]);

  // O cache de `isUserActive` guarda por 60 s — sem limpar, a sessão seguiria passando nesse tempo.
  clearAccountStatusCache();
}
