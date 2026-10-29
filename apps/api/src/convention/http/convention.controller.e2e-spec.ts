import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  conventionEndpoints,
  timeSlotEndpoints,
  type UpdateConventionBody,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';
import { resetDatabase } from '../../../test/database.js';

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
      timeSlots: [],
      tables: [],
      end: null,
      presenceCode: expect.any(String),
    });
  });

  it('finit à la fin de son dernier créneau, le jour de sa date ; sans date, pas de fin', async () => {
    const addTimeSlot = (start: string, end: string) =>
      request(app.getHttpServer())
        .post(apiUrl(timeSlotEndpoints.add))
        .send({ start, end })
        .expect(201);
    await addTimeSlot('14:00', '18:30');
    await addTimeSlot('09:00', '11:30');
    expect((await read()).body.end).toBeNull();

    const response = await update({ name: 'Chimères 2027', date: '2027-03-14' }).expect(200);

    expect(response.body.end).toEqual({ date: '2027-03-14', time: '18:30' });
  });

  it('porte le code de présence tiré par la migration : 4 caractères sans 0, O, 1, I ni L (ID-2)', async () => {
    const response = await read().expect(200);

    expect(response.body.presenceCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
  });

  it('garde son code de présence à la remise à zéro des bases de test, comme un test l’a lu', async () => {
    const { presenceCode } = (await read()).body;

    await resetDatabase();

    expect((await read()).body.presenceCode).toBe(presenceCode);
  });

  it('garde son code de présence quand elle change', async () => {
    const { presenceCode } = (await read()).body;

    const response = await update({ name: 'Chimères 2027', date: '2027-03-14' }).expect(200);

    expect(response.body.presenceCode).toBe(presenceCode);
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
