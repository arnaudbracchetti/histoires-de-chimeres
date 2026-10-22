import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/database.js';

// Application complète contre une base de test dédiée, jamais la base de dev.
// Elle est migrée au démarrage et remise à zéro avant chaque test, d'où l'exécution en série.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    env: { DATABASE_URL: testDatabaseUrl },
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
  },
});
