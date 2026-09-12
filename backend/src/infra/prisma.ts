import { PrismaClient } from '@prisma/client';

/** Singleton do Prisma Client — evita esgotar o pool de conexões em dev
 * (hot reload do tsx recriaria o client a cada mudança de arquivo). */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export let prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Só para testes: troca o client do singleton por um Postgres efêmero
 * (testcontainers). Graças ao live-binding de ESM, os serviços que fizeram
 * `import { prisma }` enxergam a troca. */
export function __setPrismaForTests(client: PrismaClient): void {
  prisma = client;
}
