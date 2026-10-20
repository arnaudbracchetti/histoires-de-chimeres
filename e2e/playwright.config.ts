import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile', use: { ...devices['Pixel 7'] } }],
  // Image de production (docker-compose.yml, service app), réutilisée si elle tourne déjà.
  // La base doit contenir la convention : `pnpm prisma:seed`.
  webServer: {
    command: 'docker compose -f ../docker-compose.yml up --build app',
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 10 * 60 * 1000,
  },
});
