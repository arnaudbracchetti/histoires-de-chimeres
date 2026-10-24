import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  gameMasterEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

const UNKNOWN_ID = '8d3c1a8e-0000-4000-8000-000000000000';

describe('Disponibilités des MJ (PR-2)', () => {
  let app: INestApplication<App>;
  /** Créneau 1 : 9 h – 11 h 30 ; créneau 2 : 14 h – 16 h 30. */
  let slot1: string;
  let slot2: string;
  /** MJ « Élodie » et « Kaïros ». */
  let elodie: string;
  let kairos: string;

  const server = () => request(app.getHttpServer());
  const readConvention = async () =>
    (await server().get(apiUrl(conventionEndpoints.read)).expect(200)).body as ConventionDto;
  const readGameMaster = (gameMasterId: string) =>
    server().get(apiUrl(gameMasterEndpoints.read, { gameMasterId }));
  const declare = (gameMasterId: string, timeSlotId: string) =>
    server().put(apiUrl(availabilityEndpoints.declare, { gameMasterId, timeSlotId }));
  const withdraw = (gameMasterId: string, timeSlotId: string) =>
    server().delete(apiUrl(availabilityEndpoints.withdraw, { gameMasterId, timeSlotId }));
  /** Le nombre de disponibilités de chaque créneau, dans l'ordre de la journée. */
  const counts = async () =>
    (await readConvention()).timeSlots.map(({ availabilityCount }) => availabilityCount);

  beforeEach(async () => {
    app = await startApp();
    await server().post(apiUrl(timeSlotEndpoints.add)).send({ start: '14:00', end: '16:30' });
    const convention = (
      await server().post(apiUrl(timeSlotEndpoints.add)).send({ start: '09:00', end: '11:30' })
    ).body as ConventionDto;
    [slot1, slot2] = convention.timeSlots.map(({ id }) => id) as [string, string];
    await server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname: 'Élodie' });
    const gameMasters = (
      await server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname: 'Kaïros' })
    ).body as GameMasterDto[];
    [elodie, kairos] = gameMasters.map(({ id }) => id) as [string, string];
  });

  afterEach(async () => {
    await app.close();
  });

  it('déclare des disponibilités, et renvoie la fiche du MJ, créneaux dans l’ordre de la journée', async () => {
    await declare(elodie, slot2).expect(200);
    const response = await declare(elodie, slot1).expect(200);

    expect(response.body).toEqual({
      id: elodie,
      nickname: 'Élodie',
      availabilities: [slot1, slot2],
      scenarios: [],
      games: [],
    });
    expect((await readGameMaster(elodie).expect(200)).body).toEqual(response.body);
  });

  it('retire une disponibilité, et renvoie la fiche du MJ', async () => {
    await declare(elodie, slot1).expect(200);
    await declare(elodie, slot2).expect(200);

    const response = await withdraw(elodie, slot1).expect(200);

    expect(response.body.availabilities).toEqual([slot2]);
  });

  it('déclarer deux fois, ou retirer une disponibilité absente, ne change rien', async () => {
    await declare(elodie, slot1).expect(200);
    await declare(elodie, slot1).expect(200);
    await withdraw(elodie, slot2).expect(200);

    expect(await counts()).toEqual([1, 0]);
  });

  it('la liste des MJ et la convention donnent les disponibilités', async () => {
    await declare(elodie, slot1).expect(200);
    await declare(kairos, slot1).expect(200);
    await declare(kairos, slot2).expect(200);

    const gameMasters = (await server().get(apiUrl(gameMasterEndpoints.list)).expect(200))
      .body as GameMasterDto[];
    expect(gameMasters.map(({ availabilities }) => availabilities)).toEqual([
      [slot1],
      [slot1, slot2],
    ]);
    expect(await counts()).toEqual([2, 1]);
  });

  it('refuse de changer les heures d’un créneau qui porte une disponibilité : 422 (PR-11)', async () => {
    await declare(elodie, slot2).expect(200);

    const response = await server()
      .put(apiUrl(timeSlotEndpoints.changeHours, { timeSlotId: slot2 }))
      .send({ start: '15:00', end: '17:00' })
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ code: 'time-slot-hours-locked', title: 'Heures figées' });
    expect(response.body.detail).toContain('créneau 2');
    expect((await readConvention()).timeSlots[1]).toMatchObject({ start: '14:00', end: '16:30' });
  });

  it('supprimer un créneau supprime ses disponibilités (PR-10)', async () => {
    await declare(elodie, slot1).expect(200);
    await declare(elodie, slot2).expect(200);

    await server()
      .delete(apiUrl(timeSlotEndpoints.remove, { timeSlotId: slot1 }))
      .expect(200);

    expect((await readGameMaster(elodie).expect(200)).body.availabilities).toEqual([slot2]);
  });

  it('supprimer un MJ supprime ses disponibilités (PR-12)', async () => {
    await declare(elodie, slot1).expect(200);
    await declare(kairos, slot1).expect(200);

    await server()
      .delete(apiUrl(gameMasterEndpoints.remove, { gameMasterId: elodie }))
      .expect(204);

    expect(await counts()).toEqual([1, 0]);
  });

  it.each([
    ['déclarer', () => declare(elodie, UNKNOWN_ID)],
    ['retirer', () => withdraw(elodie, UNKNOWN_ID)],
    ['déclarer, par un identifiant mal formé,', () => declare(elodie, 'abc')],
  ])(
    'répond 404 time-slot-not-found pour %s une disponibilité sur un créneau inconnu',
    async (_, action) => {
      const response = await action().expect(404);

      expect(response.body).toMatchObject({ code: 'time-slot-not-found' });
    },
  );

  it.each([
    ['déclarer', () => declare(UNKNOWN_ID, slot1)],
    ['retirer', () => withdraw(UNKNOWN_ID, slot1)],
  ])(
    'répond 404 game-master-not-found pour %s la disponibilité d’un MJ inconnu',
    async (_, action) => {
      const response = await action().expect(404);

      expect(response.body).toMatchObject({ code: 'game-master-not-found' });
    },
  );
});
