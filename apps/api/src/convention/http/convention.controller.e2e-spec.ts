import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { apiUrl, conventionEndpoints, type UpdateConventionBody } from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Convention', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const read = () => request(app.getHttpServer()).get(apiUrl(conventionEndpoints.read));
  const update = (body: UpdateConventionBody | object | string) =>
    request(app.getHttpServer())
      .put(apiUrl(conventionEndpoints.update))
      .set('Content-Type', 'application/json')
      .send(body);

  it('renvoie la convention créée par la migration, avec son nom provisoire et sans date', async () => {
    const response = await read().expect(200);

    expect(response.body).toEqual({
      id: expect.any(String),
      name: 'Histoires de Chimères',
      date: null,
    });
  });

  it('enregistre le nom et la date, et les relit', async () => {
    const written = await update({ name: 'Chimères 2027', date: '2027-03-14' }).expect(200);
    const response = await read().expect(200);

    expect(written.body).toEqual(response.body);
    expect(response.body).toMatchObject({ name: 'Chimères 2027', date: '2027-03-14' });
  });

  it('efface la date', async () => {
    await update({ name: 'Chimères 2027', date: '2027-03-14' }).expect(200);

    const response = await update({ name: 'Chimères 2027', date: null }).expect(200);

    expect(response.body).toMatchObject({ date: null });
  });

  it('refuse un nom vide : 422, rattaché au champ name', async () => {
    const response = await update({ name: '  ', date: null })
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      status: 422,
      code: 'convention-name-required',
      title: 'Nom obligatoire',
      errors: [{ field: 'name', code: 'convention-name-required' }],
    });
    expect((await read()).body).toMatchObject({ name: 'Histoires de Chimères' });
  });

  it.each([
    ['un nom qui n’est pas un texte', { name: 42, date: null }],
    ['une date mal formée', { name: 'Chimères', date: '14/03/2027' }],
    ['une date qui n’existe pas', { name: 'Chimères', date: '2027-02-30' }],
    ['un champ manquant', { name: 'Chimères' }],
    ['un JSON illisible', '{"name":'],
  ])('refuse %s : 400 malformed-request', async (_, body) => {
    const response = await update(body)
      .expect(400)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ status: 400, code: 'malformed-request' });
  });
});
