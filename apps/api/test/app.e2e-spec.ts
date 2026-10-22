import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { apiUrl, healthEndpoints } from '@chimeres/contract';
import { startApp } from './app.js';

describe('Application (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('répond au contrôle de santé', () => {
    return request(app.getHttpServer())
      .get(apiUrl(healthEndpoints.check))
      .expect(200)
      .expect({ status: 'ok' });
  });
});
