import { defineConfig, devices } from '@playwright/test';
import { apiUrl, healthEndpoints } from '@chimeres/contract';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      testDir: './tests/front-office',
      use: { ...devices['Pixel 7'] },
      // La remise à zéro de chaque test du bureau effacerait les pseudos et les téléphones reliés
      // des tests mobiles : ils passent après. `--no-deps` lance le projet mobile seul.
      dependencies: ['bureau'],
    },
    {
      name: 'bureau',
      testDir: './tests/back-office',
      use: { viewport: { width: 1280, height: 800 } },
      // Chaque test remet à zéro la base e2e (fixtures.ts) : un seul à la fois.
      fullyParallel: false,
      workers: 1,
    },
  ],
  // Image de production sur sa base e2e dédiée (docker-compose.yml, service app-e2e),
  // réutilisée si elle tourne déjà. Elle applique les migrations, qui créent la convention.
  webServer: {
    command: 'docker compose -f ../docker-compose.yml up --build app-e2e',
    url: `${baseURL}${apiUrl(healthEndpoints.check)}`,
    reuseExistingServer: true,
    timeout: 10 * 60 * 1000,
  },
});
