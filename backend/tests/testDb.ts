import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/** Sobe um Postgres efêmero em Docker e aplica o schema atual via `prisma db
 * push` — equivalente ao SQLite in-memory do TestDb.cs original, mas em
 * Postgres real (mesmos enums/precisão do schema de produção). Requer Docker
 * instalado apenas para RODAR os testes; não é usado em dev. */
export class TestDb {
  private constructor(
    private readonly container: StartedPostgreSqlContainer,
    public readonly prisma: PrismaClient,
  ) {}

  static async start(): Promise<TestDb> {
    const container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const url = container.getConnectionUri();
    execSync('npx prisma db push --skip-generate', {
      cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
      stdio: 'pipe',
    });
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    return new TestDb(container, prisma);
  }

  async stop(): Promise<void> {
    await this.prisma.$disconnect();
    await this.container.stop();
  }
}
