import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { TestDb } from './testDb.js';

describe('email verification / password reset tokens', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await TestDb.start();
    __setPrismaForTests(db.prisma);
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  async function createUser(email: string) {
    return db.prisma.user.create({ data: { name: 'Ana', email, passwordHash: 'x' } });
  }

  it('issueToken + consumeToken round-trips and is single-use', async () => {
    const { issueToken, consumeToken } = await import('../src/infra/auth/verificationTokens.js');
    const user = await createUser('token1@example.com');

    const raw = await issueToken(user.id, 'EmailVerification', 60_000);
    const userId = await consumeToken(raw, 'EmailVerification');
    expect(userId).toBe(user.id);

    // Já foi usado — não pode ser consumido de novo.
    expect(await consumeToken(raw, 'EmailVerification')).toBeNull();
  });

  it('consumeToken rejects an expired token', async () => {
    const { issueToken, consumeToken } = await import('../src/infra/auth/verificationTokens.js');
    const user = await createUser('token2@example.com');

    const raw = await issueToken(user.id, 'PasswordReset', -1); // já expirado
    expect(await consumeToken(raw, 'PasswordReset')).toBeNull();
  });

  it('consumeToken rejects a token consumed under the wrong purpose', async () => {
    const { issueToken, consumeToken } = await import('../src/infra/auth/verificationTokens.js');
    const user = await createUser('token3@example.com');

    const raw = await issueToken(user.id, 'EmailVerification', 60_000);
    expect(await consumeToken(raw, 'PasswordReset')).toBeNull();
  });

  it('issuing a new token invalidates the previous pending one', async () => {
    const { issueToken, consumeToken } = await import('../src/infra/auth/verificationTokens.js');
    const user = await createUser('token4@example.com');

    const first = await issueToken(user.id, 'EmailVerification', 60_000);
    const second = await issueToken(user.id, 'EmailVerification', 60_000);

    expect(await consumeToken(first, 'EmailVerification')).toBeNull();
    expect(await consumeToken(second, 'EmailVerification')).toBe(user.id);
  });

  it('confirmEmailVerification sets emailVerifiedAt', async () => {
    const { issueToken } = await import('../src/infra/auth/verificationTokens.js');
    const { confirmEmailVerification } = await import('../src/services/authService.js');
    const user = await createUser('verify@example.com');
    expect(user.emailVerifiedAt).toBeNull();

    const raw = await issueToken(user.id, 'EmailVerification', 60_000);
    await confirmEmailVerification(raw);

    const updated = await db.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.emailVerifiedAt).not.toBeNull();
  });

  it('resetPassword changes the password hash and marks the e-mail as verified', async () => {
    const { issueToken } = await import('../src/infra/auth/verificationTokens.js');
    const { resetPassword } = await import('../src/services/authService.js');
    const { verifyPassword } = await import('../src/infra/auth/passwordHasher.js');
    const user = await createUser('reset@example.com');

    const raw = await issueToken(user.id, 'PasswordReset', 60_000);
    await resetPassword(raw, 'novaSenha123');

    const updated = await db.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(verifyPassword('novaSenha123', updated.passwordHash)).toBe(true);
    expect(updated.emailVerifiedAt).not.toBeNull();
  });

  it('resetPassword rejects an already-used token', async () => {
    const { issueToken } = await import('../src/infra/auth/verificationTokens.js');
    const { resetPassword } = await import('../src/services/authService.js');
    const user = await createUser('reset2@example.com');

    const raw = await issueToken(user.id, 'PasswordReset', 60_000);
    await resetPassword(raw, 'primeiraSenha1');
    await expect(resetPassword(raw, 'segundaSenha2')).rejects.toThrow(/inválido ou expirado/);
  });
});
