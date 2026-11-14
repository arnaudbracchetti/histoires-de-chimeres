import type { INestApplication } from '@nestjs/common';
import { request } from './http.js';
import type { App } from 'supertest/types.js';
import { API_PREFIX, apiUrl, healthEndpoints } from '@chimeres/contract';
import { startApp } from './app.js';

describe('Application (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('répond au contrôle de santé, en version « dev » hors image', () => {
    vi.stubEnv('APP_VERSION', undefined);

    return request(app)
      .get(apiUrl(healthEndpoints.check))
      .expect(200)
      .expect({ status: 'ok', version: 'dev' });
  });

  it("donne la version de l'image, lue dans APP_VERSION", () => {
    vi.stubEnv('APP_VERSION', 'v1.2.3');

    return request(app)
      .get(apiUrl(healthEndpoints.check))
      .expect(200)
      .expect({ status: 'ok', version: 'v1.2.3' });
  });

  it('répond 404 à une route inconnue, sans la traiter en erreur interne', () => {
    return request(app).get(`/${API_PREFIX}/route-inconnue`).expect(404);
  });
});
