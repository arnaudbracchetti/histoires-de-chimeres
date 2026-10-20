import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { ConventionReader } from '@chimeres/application';
import type { ConventionDto } from '@chimeres/contract';
import { CONVENTION_READER } from '../convention-reader.token.js';
import { ConventionModule } from '../convention.module.js';

describe('GET /convention', () => {
  let app: INestApplication<App>;

  const start = async (convention: ConventionDto | null) => {
    const reader: ConventionReader = { read: async () => convention };
    const moduleRef = await Test.createTestingModule({ imports: [ConventionModule] })
      .overrideProvider(CONVENTION_READER)
      .useValue(reader)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => {
    await app.close();
  });

  it('renvoie la convention', async () => {
    const convention = { id: 'c1', name: 'Histoires de Chimères' };
    await start(convention);

    await request(app.getHttpServer()).get('/convention').expect(200).expect(convention);
  });

  it('répond 404 sans convention enregistrée', async () => {
    await start(null);

    await request(app.getHttpServer()).get('/convention').expect(404);
  });
});
