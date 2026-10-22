import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { apiUrl, conventionEndpoints } from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Lecture de la convention', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('renvoie la convention créée par la migration, avec son nom provisoire', async () => {
    const response = await request(app.getHttpServer())
      .get(apiUrl(conventionEndpoints.read))
      .expect(200);

    expect(response.body).toEqual({ id: expect.any(String), name: 'Histoires de Chimères' });
  });
});
