import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  conventionEndpoints,
  linkedPhoneEndpoints,
  tableEndpoints,
} from '@chimeres/contract';
import { startApp } from '../../test/app.js';

const PUBLIC_URL = 'https://chimeres.example.org';

describe('Garde CSRF (ADR 0019)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.stubEnv('PUBLIC_URL', `${PUBLIC_URL}/`);
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  const addTable = () =>
    request(app.getHttpServer()).post(apiUrl(tableEndpoints.add)).send({ name: 'Dragon' });

  it('refuse une écriture sans Sec-Fetch-Site ni Origin : 403, en Problem Details', async () => {
    const response = await addTable()
      .expect(403)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ code: 'cross-site-request', status: 403 });
  });

  it.each(['cross-site', 'same-site', 'none'])(
    'refuse une écriture dont Sec-Fetch-Site vaut %s, même avec le bon Origin',
    async (site) => {
      await addTable().set('Sec-Fetch-Site', site).set('Origin', PUBLIC_URL).expect(403);
    },
  );

  it('accepte une écriture same-origin', async () => {
    await addTable().set('Sec-Fetch-Site', 'same-origin').expect(201);
  });

  it('accepte, sans Sec-Fetch-Site, un Origin égal au domaine public', async () => {
    await addTable().set('Origin', PUBLIC_URL).expect(201);
  });

  it('refuse, sans Sec-Fetch-Site, un Origin d’un autre site', async () => {
    await addTable().set('Origin', 'https://chimeres.example.org.evil.test').expect(403);
  });

  // Aucun endpoint n'est en PATCH : le garde le refuse aussi, mais Nest répondrait d'abord 404.
  it.each(['put', 'delete'] as const)('refuse aussi un %s venu d’ailleurs', async (method) => {
    await request(app.getHttpServer())
      [method](apiUrl(tableEndpoints.rename, { tableId: 'inconnue' }))
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(403);
  });

  it('protège aussi le front office : relier un téléphone venu d’ailleurs est refusé', async () => {
    await request(app.getHttpServer())
      .post(apiUrl(linkedPhoneEndpoints.link))
      .set('Sec-Fetch-Site', 'cross-site')
      .send({ presenceCode: 'ABCD', nickname: 'Élodie', confirmation: null })
      .expect(403);
  });

  it('laisse passer les lectures, d’où qu’elles viennent', async () => {
    await request(app.getHttpServer())
      .get(apiUrl(conventionEndpoints.read))
      .set('Sec-Fetch-Site', 'cross-site')
      .expect(200);
  });
});

describe('Garde CSRF sans domaine public configuré', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    vi.stubEnv('PUBLIC_URL', '');
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  it('refuse un Origin sans Sec-Fetch-Site, mais accepte same-origin', async () => {
    const add = () =>
      request(app.getHttpServer()).post(apiUrl(tableEndpoints.add)).send({ name: 'Dragon' });

    await add().set('Origin', 'http://localhost').expect(403);
    await add().set('Sec-Fetch-Site', 'same-origin').expect(201);
  });
});
