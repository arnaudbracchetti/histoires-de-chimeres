import { defineConfig } from 'vitest/config';
import { testWorkerCount } from './test/database.js';

// Application complète contre des bases de test dédiées, jamais la base de dev : une par worker,
// migrée au démarrage et remise à zéro avant chaque test. Les fichiers d'un worker passent en série.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    maxWorkers: testWorkerCount,
  },
});
