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
  signUpEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type FrontOfficeScheduleDto,
  type GameMasterDto,
  type ScenarioDto,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Inscriptions du front office (IN-2)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const withCookie = (call: request.Test, cookie?: string) =>
    cookie ? call.set('Cookie', cookie) : call;
  const signUp = (gameId: string, cookie?: string) =>
    withCookie(server().put(apiUrl(signUpEndpoints.signUp, { gameId })), cookie);
  const withdraw = (gameId: string, cookie?: string) =>
    withCookie(server().delete(apiUrl(signUpEndpoints.withdraw, { gameId })), cookie);
  const withdrawFromDraw = (timeSlotId: string, cookie?: string) =>
    withCookie(server().delete(apiUrl(signUpEndpoints.withdrawFromDraw, { timeSlotId })), cookie);
  const readSituation = (cookie: string) =>
    withCookie(server().get(apiUrl(frontOfficeEndpoints.readSituation)), cookie);
  const signUpCountOf = async (gameId: string, cookie: string) => {
    const response = await withCookie(
      server().get(apiUrl(frontOfficeEndpoints.readSchedule)),
      cookie,
    ).expect(200);
    return (response.body as FrontOfficeScheduleDto).games.find(({ id }) => id === gameId)!
      .signUpCount;
  };

  /**
   * Un téléphone relié à un pseudo nouveau, ou à un MJ avec `confirmation` (ID-3) : son cookie,
   * `nom=valeur`.
   */
  const linkedPhone = async (nickname: string, confirmation: 'game-master' | null = null) => {
    const { presenceCode } = (await server().get(apiUrl(conventionEndpoints.read)).expect(200))
      .body as ConventionDto;
    const response = await server()
      .post(apiUrl(linkedPhoneEndpoints.link))
      .send({ presenceCode, nickname, confirmation })
      .expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  };

  /** Une écriture de préparation, qui doit réussir : le corps de sa réponse. */
  const send = async <T>(call: request.Test): Promise<T> => {
    const response = await call;
    expect(response.status, JSON.stringify(response.body)).toBeLessThan(300);
    return response.body as T;
  };

  /** Un créneau (9 h – 11 h 30), où « Brann » mène « Les Brumes d'Innsmouth » : l'id de la partie et du créneau. */
  const prepare = async () => {
    const { timeSlots } = await send<ConventionDto>(
      server().post(apiUrl(timeSlotEndpoints.add)).send({ start: '09:00', end: '11:30' }),
    );
    const { tables } = await send<ConventionDto>(
      server().post(apiUrl(tableEndpoints.add)).send({ name: 'Griffon' }),
    );
    const [brann] = await send<GameMasterDto[]>(
      server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname: 'Brann' }),
    );
    const timeSlotId = timeSlots[0]!.id;
    await send(
      server().put(apiUrl(availabilityEndpoints.declare, { gameMasterId: brann!.id, timeSlotId })),
    );
    const scenario = await send<ScenarioDto>(
      server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: brann!.id }))
        .send({
          title: "Les Brumes d'Innsmouth",
          system: "L'Appel de Cthulhu",
          presentation: 'Une enquête.',
          contentWarnings: '',
          seats: { min: 3, max: 5 },
          duration: 1,
        }),
    );
    await send(
      server()
        .post(apiUrl(scheduleEndpoints.schedule))
        .send({ scenarioId: scenario.id, timeSlotId, tableId: tables[0]!.id }),
    );
    const organizer = await linkedPhone('Organisateur');
    const { games } = (
      await withCookie(server().get(apiUrl(frontOfficeEndpoints.readSchedule)), organizer).expect(
        200,
      )
    ).body as FrontOfficeScheduleDto;
    return { gameId: games[0]!.id, timeSlotId };
  };

  /** « Kaïros » mène « Les Néons » sur ce créneau, à la table Licorne : l'id de la partie. */
  const scheduleOtherGame = async (timeSlotId: string) => {
    const { tables } = await send<ConventionDto>(
      server().post(apiUrl(tableEndpoints.add)).send({ name: 'Licorne' }),
    );
    const gameMasters = await send<GameMasterDto[]>(
      server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname: 'Kaïros' }),
    );
    const kairos = gameMasters.find(({ nickname }) => nickname === 'Kaïros')!;
    await send(
      server().put(apiUrl(availabilityEndpoints.declare, { gameMasterId: kairos.id, timeSlotId })),
    );
    const scenario = await send<ScenarioDto>(
      server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: kairos.id }))
        .send({
          title: 'Les Néons',
          system: 'Cyberpunk',
          presentation: 'Une course.',
          contentWarnings: '',
          seats: { min: 3, max: 5 },
          duration: 1,
        }),
    );
    await send(
      server()
        .post(apiUrl(scheduleEndpoints.schedule))
        .send({
          scenarioId: scenario.id,
          timeSlotId,
          tableId: tables.find(({ name }) => name === 'Licorne')!.id,
        }),
    );
    const reader = await linkedPhone('Lecteur');
    const { games } = (
      await withCookie(server().get(apiUrl(frontOfficeEndpoints.readSchedule)), reader).expect(200)
    ).body as FrontOfficeScheduleDto;
    return games.find(({ title }) => title === 'Les Néons')!.id;
  };

  it('inscrit le pseudo du téléphone : le compteur et sa situation le montrent', async () => {
    const { gameId, timeSlotId } = await prepare();
    const elodie = await linkedPhone('Élodie');

    await signUp(gameId, elodie).expect(204);

    expect(await signUpCountOf(gameId, elodie)).toBe(1);
    expect((await readSituation(elodie).expect(200)).body).toEqual({
      signedUpGameIds: [gameId],
      backupGameIds: [],
      timeSlots: [
        {
          timeSlotId,
          state: 'sign-ups-open',
          ledGameId: null,
          drawResult: null,
          withoutGame: false,
        },
      ],
    });
  });

  it('refuse le MJ sur sa propre partie, et sa situation donne sa partie (IN-4)', async () => {
    const { gameId, timeSlotId } = await prepare();
    const brann = await linkedPhone('Brann', 'game-master');

    const response = await signUp(gameId, brann).expect(422);

    expect(response.body).toMatchObject({
      code: 'game-led-by-participant',
      detail: "Tu mènes cette partie\u00a0: tu ne peux pas t'y inscrire.",
    });
    expect(await signUpCountOf(gameId, brann)).toBe(0);
    expect((await readSituation(brann).expect(200)).body).toEqual({
      signedUpGameIds: [],
      backupGameIds: [],
      timeSlots: [
        {
          timeSlotId,
          state: 'sign-ups-open',
          ledGameId: gameId,
          drawResult: null,
          withoutGame: false,
        },
      ],
    });
  });

  it('inscrit en secours le MJ à une autre partie du créneau où il mène, sans la compter (IN-4)', async () => {
    const { gameId, timeSlotId } = await prepare();
    const otherGameId = await scheduleOtherGame(timeSlotId);
    const kairos = await linkedPhone('Kaïros', 'game-master');

    await signUp(gameId, kairos).expect(204);

    expect(await signUpCountOf(gameId, kairos)).toBe(0);
    expect((await readSituation(kairos).expect(200)).body).toMatchObject({
      signedUpGameIds: [],
      backupGameIds: [gameId],
      timeSlots: [{ timeSlotId, ledGameId: otherGameId }],
    });
  });

  it('ne change rien à une inscription répétée', async () => {
    const { gameId } = await prepare();
    const elodie = await linkedPhone('Élodie');
    await signUp(gameId, elodie).expect(204);

    await signUp(gameId, elodie).expect(204);

    expect(await signUpCountOf(gameId, elodie)).toBe(1);
  });

  it('désinscrit le pseudo du téléphone, sans toucher aux autres inscrits', async () => {
    const { gameId } = await prepare();
    const elodie = await linkedPhone('Élodie');
    const lune = await linkedPhone('Lune');
    await signUp(gameId, elodie).expect(204);
    await signUp(gameId, lune).expect(204);

    await withdraw(gameId, elodie).expect(204);

    expect(await signUpCountOf(gameId, elodie)).toBe(1);
    expect((await readSituation(elodie).expect(200)).body).toMatchObject({ signedUpGameIds: [] });
  });

  it('ne change rien à la désinscription d’une partie déjà quittée', async () => {
    const { gameId } = await prepare();
    const elodie = await linkedPhone('Élodie');
    await signUp(gameId, elodie).expect(204);
    await withdraw(gameId, elodie).expect(204);

    await withdraw(gameId, elodie).expect(204);

    expect(await signUpCountOf(gameId, elodie)).toBe(0);
  });

  it('refuse une partie introuvable', async () => {
    await prepare();
    const elodie = await linkedPhone('Élodie');

    const response = await signUp('00000000-0000-4000-8000-000000000000', elodie).expect(404);

    expect(response.body).toMatchObject({ code: 'game-not-found' });
  });

  it('garde le pseudo dans le tirage du créneau quand sa partie est déprogrammée, puis l’en retire (IN-6)', async () => {
    const { gameId, timeSlotId } = await prepare();
    const elodie = await linkedPhone('Élodie');
    await signUp(gameId, elodie).expect(204);
    await server().delete(apiUrl(scheduleEndpoints.unschedule, { gameId })).expect(200);
    const withoutGameOf = async () =>
      (await readSituation(elodie).expect(200)).body.timeSlots[0].withoutGame as boolean;
    const withoutGameBefore = await withoutGameOf();

    await withdrawFromDraw(timeSlotId, elodie).expect(204);

    expect(withoutGameBefore).toBe(true);
    expect(await withoutGameOf()).toBe(false);
    await withdrawFromDraw(timeSlotId, elodie).expect(204);
  });

  it('refuse un téléphone relié à aucun pseudo', async () => {
    const { gameId, timeSlotId } = await prepare();

    expect((await signUp(gameId).expect(401)).body).toMatchObject({ code: 'phone-not-linked' });
    expect((await withdraw(gameId).expect(401)).body).toMatchObject({ code: 'phone-not-linked' });
    expect((await withdrawFromDraw(timeSlotId).expect(401)).body).toMatchObject({
      code: 'phone-not-linked',
    });
    const situation = await server().get(apiUrl(frontOfficeEndpoints.readSituation)).expect(401);
    expect(situation.body).toMatchObject({ code: 'phone-not-linked' });
  });
});
