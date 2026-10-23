import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  conventionEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type TimeSlotHoursBody,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Créneaux', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const read = async () =>
    (await server().get(apiUrl(conventionEndpoints.read)).expect(200)).body as ConventionDto;
  const add = (body: TimeSlotHoursBody | object) =>
    server().post(apiUrl(timeSlotEndpoints.add)).send(body);
  const update = (timeSlotId: string, body: TimeSlotHoursBody | object) =>
    server().put(apiUrl(timeSlotEndpoints.changeHours, { timeSlotId })).send(body);
  const remove = (timeSlotId: string) =>
    server().delete(apiUrl(timeSlotEndpoints.remove, { timeSlotId }));
  /** Les créneaux, en « rang début-fin ». */
  const schedule = ({ timeSlots }: ConventionDto) =>
    timeSlots.map(({ rank, start, end }) => `${rank} ${start}-${end}`);
  const idOf = async (rank: number) => (await read()).timeSlots[rank - 1]!.id;

  it('la convention n’a d’abord aucun créneau', async () => {
    expect((await read()).timeSlots).toEqual([]);
  });

  it('ajoute des créneaux, renvoyés dans l’ordre de la journée avec leur rang', async () => {
    await add({ start: '14:00', end: '16:30' }).expect(201);
    const response = await add({ start: '09:00', end: '11:30' }).expect(201);

    expect(schedule(response.body)).toEqual(['1 09:00-11:30', '2 14:00-16:30']);
    expect(response.body).toEqual(await read());
    expect((await read()).timeSlots[0]).toEqual({
      id: expect.any(String),
      rank: 1,
      start: '09:00',
      end: '11:30',
      availabilityCount: 0,
    });
  });

  it('accepte deux créneaux bout à bout', async () => {
    await add({ start: '09:00', end: '11:30' }).expect(201);

    await add({ start: '11:30', end: '14:00' }).expect(201);

    expect(schedule(await read())).toEqual(['1 09:00-11:30', '2 11:30-14:00']);
  });

  it('refuse un chevauchement : 422, rattaché à la fin', async () => {
    await add({ start: '14:00', end: '16:30' }).expect(201);

    const response = await add({ start: '12:00', end: '14:30' })
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      code: 'time-slot-end-overlaps',
      errors: [{ field: 'end', code: 'time-slot-end-overlaps' }],
    });
    expect(response.body.detail).toContain('créneau 1');
    expect(schedule(await read())).toEqual(['1 14:00-16:30']);
  });

  it('refuse un chevauchement par le début : 422, rattaché au début', async () => {
    await add({ start: '14:00', end: '16:30' }).expect(201);

    const response = await add({ start: '16:00', end: '18:00' }).expect(422);

    expect(response.body).toMatchObject({
      code: 'time-slot-start-overlaps',
      errors: [{ field: 'start', code: 'time-slot-start-overlaps' }],
    });
  });

  it('refuse une fin avant le début : 422, rattaché à la fin', async () => {
    const response = await add({ start: '14:00', end: '13:00' }).expect(422);

    expect(response.body).toMatchObject({
      code: 'time-slot-end-not-after-start',
      errors: [{ field: 'end' }],
    });
  });

  it('change les heures d’un créneau, et son rang suit', async () => {
    await add({ start: '09:00', end: '11:30' }).expect(201);
    await add({ start: '14:00', end: '16:30' }).expect(201);

    const response = await update(await idOf(1), { start: '17:00', end: '19:30' }).expect(200);

    expect(schedule(response.body)).toEqual(['1 14:00-16:30', '2 17:00-19:30']);
  });

  it('supprime un créneau', async () => {
    await add({ start: '09:00', end: '11:30' }).expect(201);
    await add({ start: '14:00', end: '16:30' }).expect(201);

    const response = await remove(await idOf(1)).expect(200);

    expect(schedule(response.body)).toEqual(['1 14:00-16:30']);
    expect(schedule(await read())).toEqual(['1 14:00-16:30']);
  });

  it.each([
    ['changer ses heures', (id: string) => update(id, { start: '09:00', end: '10:00' })],
    ['le supprimer', (id: string) => remove(id)],
  ])('répond 404 time-slot-not-found pour %s d’un créneau inconnu', async (_, action) => {
    const response = await action('8d3c1a8e-0000-4000-8000-000000000000')
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ status: 404, code: 'time-slot-not-found' });
  });

  it.each([
    ['une heure sans zéro', { start: '9:00', end: '11:30' }],
    ['minuit comme fin', { start: '22:00', end: '24:00' }],
    ['une heure manquante', { start: '09:00' }],
    ['un champ en trop', { start: '09:00', end: '11:30', rank: 1 }],
  ])('refuse %s : 400 malformed-request', async (_, body) => {
    const response = await add(body).expect(400);

    expect(response.body).toMatchObject({ code: 'malformed-request' });
  });
});
