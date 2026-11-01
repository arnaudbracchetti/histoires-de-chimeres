import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  gameMasterEndpoints,
  linkedPhoneEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  signUpEndpoints,
  signUpTrackingEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type ScenarioDto,
  type ScheduleDto,
  type SignUpTrackingDto,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Suivi des inscriptions', () => {
  let app: INestApplication<App>;
  /** Créneaux 1 (9 h – 11 h 30) et 2 (14 h – 16 h 30), tables « Table 10 » et « Table 2 ». */
  let convention: ConventionDto;

  const server = () => request(app.getHttpServer());
  const slot = (rank: number) => convention.timeSlots[rank - 1]!.id;
  const table = (name: string) => convention.tables.find((t) => t.name === name)!.id;

  /** Un MJ disponible sur le créneau 1. */
  const gameMaster = async (nickname: string) => {
    const added = (
      (await server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname }).expect(201))
        .body as GameMasterDto[]
    ).find((candidate) => candidate.nickname === nickname)!;
    await server()
      .put(apiUrl(availabilityEndpoints.declare, { gameMasterId: added.id, timeSlotId: slot(1) }))
      .expect(200);
    return added;
  };

  /** Programme un scénario du MJ au créneau 1, à la table : l'id de la partie. */
  const scheduled = async (
    gameMasterId: string,
    title: string,
    seats: { min: number; max: number },
    tableName: string,
  ) => {
    const scenario = (
      await server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId }))
        .send({
          title,
          system: 'Cthulhu',
          presentation: 'Une enquête.',
          contentWarnings: '',
          seats,
          duration: 1,
        })
        .expect(201)
    ).body as ScenarioDto;
    const schedule = (
      await server()
        .post(apiUrl(scheduleEndpoints.schedule))
        .send({ scenarioId: scenario.id, timeSlotId: slot(1), tableId: table(tableName) })
        .expect(201)
    ).body as ScheduleDto;
    return schedule.games.find((game) => game.scenario.id === scenario.id)!.id;
  };

  /** Un téléphone relié au pseudo : son cookie, `nom=valeur`. */
  const linkedPhone = async (nickname: string) => {
    const response = await server()
      .post(apiUrl(linkedPhoneEndpoints.link))
      .send({ presenceCode: convention.presenceCode, nickname, confirmation: null })
      .expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  };

  const signUp = (gameId: string, cookie: string) =>
    server().put(apiUrl(signUpEndpoints.signUp, { gameId })).set('Cookie', cookie).expect(204);

  beforeEach(async () => {
    app = await startApp();
    for (const [start, end] of [
      ['09:00', '11:30'],
      ['14:00', '16:30'],
    ]) {
      await server().post(apiUrl(timeSlotEndpoints.add)).send({ start, end }).expect(201);
    }
    for (const name of ['Table 10', 'Table 2']) {
      await server().post(apiUrl(tableEndpoints.add)).send({ name }).expect(201);
    }
    convention = (await server().get(apiUrl(conventionEndpoints.read)).expect(200))
      .body as ConventionDto;
  });

  afterEach(async () => {
    await app.close();
  });

  it('rend la demande et la capacité de chaque créneau, et les tables dans l’ordre naturel', async () => {
    const elodie = await gameMaster('Élodie');
    const kairos = await gameMaster('Kaïros');
    const neons = await scheduled(elodie.id, 'Néons', { min: 3, max: 5 }, 'Table 10');
    const brumes = await scheduled(kairos.id, 'Brumes', { min: 2, max: 4 }, 'Table 2');
    const lune = await linkedPhone('Lune');
    const sven = await linkedPhone('Sven');
    await signUp(neons, lune);
    await signUp(brumes, lune);
    await signUp(brumes, sven);

    const dto = (await server().get(apiUrl(signUpTrackingEndpoints.read)).expect(200))
      .body as SignUpTrackingDto;

    expect(dto).toEqual({
      timeSlots: [
        {
          id: slot(1),
          rank: 1,
          start: '09:00',
          end: '11:30',
          state: 'sign-ups-open',
          demand: 2,
          capacity: { min: 5, max: 9 },
        },
        {
          id: slot(2),
          rank: 2,
          start: '14:00',
          end: '16:30',
          state: 'sign-ups-open',
          demand: 0,
          capacity: { min: 0, max: 0 },
        },
      ],
      tables: [
        { id: table('Table 2'), name: 'Table 2' },
        { id: table('Table 10'), name: 'Table 10' },
      ],
    });
  });
});
