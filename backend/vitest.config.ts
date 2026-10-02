import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    /**
     * Um arquivo por vez. Cinco das suítes sobem o seu próprio Postgres em Docker
     * (tests/testDb.ts, Testcontainers); em paralelo, os containers concorrentes derrubavam a
     * suíte com um erro que parecia "Docker ausente". Em série, as 42 passam em ~45 s.
     */
    fileParallelism: false,
  },
});
