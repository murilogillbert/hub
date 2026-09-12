import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { __setPrismaForTests } from '../src/infra/prisma.js';
import { TestDb } from './testDb.js';

describe('requireApiKey middleware', () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await TestDb.start();
    __setPrismaForTests(db.prisma);
  }, 120_000);

  afterAll(async () => {
    await db.stop();
  });

  function fakeReq(authHeader?: string) {
    return { headers: { authorization: authHeader }, params: {} } as any;
  }

  it('rejects a request with no Authorization header', async () => {
    const { requireApiKey } = await import('../src/middleware/apiKey.js');
    const guard = requireApiKey('affiliate:read');
    await expect(guard(fakeReq(), {} as any, vi.fn())).rejects.toThrow(/Chave de API ausente/);
  });

  it('rejects an unknown key', async () => {
    const { requireApiKey } = await import('../src/middleware/apiKey.js');
    const guard = requireApiKey('affiliate:read');
    await expect(guard(fakeReq('Bearer odh_svc_doesnotexist'), {} as any, vi.fn())).rejects.toThrow(/inválida/);
  });

  it('accepts a valid key with the right scope and calls next()', async () => {
    const { generateApiKey } = await import('../src/infra/auth/apiKey.js');
    const { requireApiKey } = await import('../src/middleware/apiKey.js');
    const { key, hashedKey, keyPreview } = generateApiKey();
    await db.prisma.serviceApiKey.create({
      data: { label: 'n8n', hashedKey, keyPreview, scopes: ['affiliate:read'] },
    });

    const guard = requireApiKey('affiliate:read');
    const next = vi.fn();
    await guard(fakeReq(`Bearer ${key}`), {} as any, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a valid key missing the required scope', async () => {
    const { generateApiKey } = await import('../src/infra/auth/apiKey.js');
    const { requireApiKey } = await import('../src/middleware/apiKey.js');
    const { key, hashedKey, keyPreview } = generateApiKey();
    await db.prisma.serviceApiKey.create({
      data: { label: 'n8n-readonly', hashedKey, keyPreview, scopes: ['affiliate:read'] },
    });

    const guard = requireApiKey('affiliate:write');
    await expect(guard(fakeReq(`Bearer ${key}`), {} as any, vi.fn())).rejects.toThrow(/sem permissão/);
  });

  it('rejects a revoked (inactive) key', async () => {
    const { generateApiKey } = await import('../src/infra/auth/apiKey.js');
    const { requireApiKey } = await import('../src/middleware/apiKey.js');
    const { key, hashedKey, keyPreview } = generateApiKey();
    await db.prisma.serviceApiKey.create({
      data: { label: 'revoked', hashedKey, keyPreview, scopes: ['affiliate:read'], active: false },
    });

    const guard = requireApiKey('affiliate:read');
    await expect(guard(fakeReq(`Bearer ${key}`), {} as any, vi.fn())).rejects.toThrow(/inválida/);
  });
});
