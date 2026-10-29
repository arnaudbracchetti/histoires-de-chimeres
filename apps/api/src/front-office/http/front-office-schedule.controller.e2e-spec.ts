import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  frontOfficeEndpoints,
  gameMasterEndpoints,
  linkedPhoneEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type ScenarioBody,
  type ScenarioDto,
  type UpdateConventionBody,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Programme du front office', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const readSchedule = (cookie?: string) => {
    const call = server().get(apiUrl(frontOfficeEndpoints.readSchedule));
    return cookie ? call.set('Cookie', cookie) : call;
  };

  /** Un téléphone relié à un pseudo nouveau : son cookie, `nom=valeur`. */
  const linkedPhone = async (nickname: string) => {
    const { presenceCode } = (await server().get(apiUrl(conventionEndpoints.read)).expect(200))
      .body as ConventionDto;
    const response = await server()
      .post(apiUrl(linkedPhoneEndpoints.link))
      .send({ presenceCode, nickname, confirmation: null })
      .expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  };

  /** Une écriture de préparation, qui doit réussir : le corps de sa réponse. */
  const send = async <T>(call: request.Test): Promise<T> => {
    const response = await call;
    expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
    return response.body as T;
  };

  /**
   * Créneaux 1 (9 h – 11 h 30) et 2 (14 h – 18 h 30), tables « Griffon » et « Basilic ». « Brann »
   * mène « Les Brumes d'Innsmouth » au créneau 1, table Griffon ; « Kaïros » mène « L'Épice et le
   * Sang », partie double, aux créneaux 1 et 2, table Basilic.
   */
  const prepare = async () => {
    const body: UpdateConventionBody = { name: 'Histoires de Chimères', date: '2099-03-14' };
    await send(server().put(apiUrl(conventionEndpoints.update)).send(body));
    await send(server().post(apiUrl(timeSlotEndpoints.add)).send({ start: '09:00', end: '11:30' }));
    await send(server().post(apiUrl(timeSlotEndpoints.add)).send({ start: '14:00', end: '18:30' }));
    await send(server().post(apiUrl(tableEndpoints.add)).send({ name: 'Griffon' }));
    const convention = await send<ConventionDto>(
      server().post(apiUrl(tableEndpoints.add)).send({ name: 'Basilic' }),
    );
    await send(server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname: 'Brann' }));
    const gameMasters = await send<GameMasterDto[]>(
      server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname: 'Kaïros' }),
    );
    const gameMasterId = (nickname: string) => gameMasters.find((m) => m.nickname === nickname)!.id;
    const [slot1, slot2] = convention.timeSlots.map(({ id }) => id) as [string, string];
    for (const [nickname, timeSlotId] of [
      ['Brann', slot1],
      ['Kaïros', slot1],
      ['Kaïros', slot2],
    ] as const) {
      await send(
        server().put(
          apiUrl(availabilityEndpoints.declare, {
            gameMasterId: gameMasterId(nickname),
            timeSlotId,
          }),
        ),
      );
    }
    const propose = (nickname: string, scenario: ScenarioBody) =>
      send<ScenarioDto>(
        server()
          .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: gameMasterId(nickname) }))
          .send(scenario),
      );
    const brumes = await propose('Brann', {
      title: "Les Brumes d'Innsmouth",
      system: "L'Appel de Cthulhu",
      presentation: 'Une enquête **sous** la brume.',
      contentWarnings: 'Noyade.',
      seats: { min: 3, max: 5 },
      duration: 1,
    });
    const epice = await propose('Kaïros', {
      title: "L'Épice et le Sang",
      system: 'Dune',
      presentation: 'Arrakis.',
      contentWarnings: '',
      seats: { min: 4, max: 6 },
      duration: 2,
    });
    const tableId = (name: string) => convention.tables.find((t) => t.name === name)!.id;
    await send(
      server()
        .post(apiUrl(scheduleEndpoints.schedule))
        .send({ scenarioId: brumes.id, timeSlotId: slot1, tableId: tableId('Griffon') }),
    );
    await send(
      server()
        .post(apiUrl(scheduleEndpoints.schedule))
        .send({ scenarioId: epice.id, timeSlotId: slot1, tableId: tableId('Basilic') }),
    );
    return { slot1, slot2 };
  };

  it('donne au téléphone relié tout le contenu des fiches, les créneaux et la fin de la convention', async () => {
    const { slot1, slot2 } = await prepare();
    const elodie = await linkedPhone('Élodie');

    const response = await readSchedule(elodie).expect(200);

    expect(response.body).toEqual({
      date: '2099-03-14',
      timeSlots: [
        { id: slot1, rank: 1, start: '09:00', end: '11:30' },
        { id: slot2, rank: 2, start: '14:00', end: '18:30' },
      ],
      // Dans l'ordre naturel des tables.
      games: [
        {
          id: expect.any(String),
          timeSlotIds: [slot1, slot2],
          tableName: 'Basilic',
          title: "L'Épice et le Sang",
          system: 'Dune',
          gameMasterNickname: 'Kaïros',
          imageUrl: null,
          presentation: 'Arrakis.',
          contentWarnings: '',
          seats: { min: 4, max: 6 },
          signUpCount: 0,
          oversubscribed: false,
        },
        {
          id: expect.any(String),
          timeSlotIds: [slot1],
          tableName: 'Griffon',
          title: "Les Brumes d'Innsmouth",
          system: "L'Appel de Cthulhu",
          gameMasterNickname: 'Brann',
          imageUrl: null,
          presentation: 'Une enquête **sous** la brume.',
          contentWarnings: 'Noyade.',
          seats: { min: 3, max: 5 },
          signUpCount: 0,
          oversubscribed: false,
        },
      ],
      end: { date: '2099-03-14', time: '18:30' },
    });
  });

  it('donne un programme vide à une convention sans date ni créneau', async () => {
    const elodie = await linkedPhone('Élodie');

    const response = await readSchedule(elodie).expect(200);

    expect(response.body).toEqual({ date: null, timeSlots: [], games: [], end: null });
  });

  it('refuse un téléphone sans cookie : 401 phone-not-linked', async () => {
    const response = await readSchedule().expect(401);

    expect(response.body).toMatchObject({ code: 'phone-not-linked' });
  });

  it('refuse un téléphone dont le lien est coupé : 401 phone-not-linked', async () => {
    const elodie = await linkedPhone('Élodie');
    await server().delete(apiUrl(linkedPhoneEndpoints.unlink)).set('Cookie', elodie).expect(204);

    await readSchedule(elodie).expect(401);
  });

  it('refuse après la fin de la convention : 410 convention-ended', async () => {
    const elodie = await linkedPhone('Élodie');
    const body: UpdateConventionBody = { name: 'Histoires de Chimères', date: '2020-03-14' };
    await send(server().put(apiUrl(conventionEndpoints.update)).send(body));
    await send(server().post(apiUrl(timeSlotEndpoints.add)).send({ start: '09:00', end: '11:30' }));

    const response = await readSchedule(elodie).expect(410);

    expect(response.body).toMatchObject({ code: 'convention-ended' });
  });
});
