import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import {
  accountEndpoints,
  apiUrl,
  gameMasterEndpoints,
  participantEndpoints,
  type GameMasterDto,
  type ParticipantListEntryDto,
} from '@chimeres/contract';
import { insertAccountSession, TEST_ORGANIZER_NICKNAME } from '../../test/account-session.js';
import { startApp } from '../../test/app.js';
import { setEnvironment } from '../../test/environment.js';
import { request, type Response } from '../../test/http.js';

const PASSWORD = 'une longue phrase';

const readSessionCookie = (response: Response) =>
  (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

describe('Premier Organisateur de la configuration (ADR 0016)', () => {
  let app: INestApplication<App> | undefined;
  let restoreEnvironment: () => void = () => {};
  /** La session de l'Organisateur des tests (ADR 0020), qui lit la liste des pseudos. */
  let organizerCookie: string;

  beforeEach(async () => {
    organizerCookie = await insertAccountSession();
  });

  /** Démarre l'application avec ces variables, après avoir arrêté la précédente. */
  const restartWithVariables = async (variables: { pseudo?: string; password?: string }) => {
    await app?.close();
    app = undefined;
    restoreEnvironment();
    restoreEnvironment = setEnvironment({
      ORGANIZER_PSEUDO: variables.pseudo,
      ORGANIZER_PASSWORD: variables.password,
    });
    app = await startApp();
  };

  afterEach(async () => {
    await app?.close();
    app = undefined;
    restoreEnvironment();
    restoreEnvironment = () => {};
  });

  const logIn = (nickname: string, password: string) =>
    request(app!).post(apiUrl(accountEndpoints.logIn)).send({ nickname, password });
  const readAccount = (cookie: string) =>
    request(app!).get(apiUrl(accountEndpoints.read)).set('Cookie', cookie);
  /** Les pseudos de la convention, hors l'Organisateur des tests. */
  const participants = async () =>
    (
      (await request(app!, organizerCookie).get(apiUrl(participantEndpoints.list)).expect(200))
        .body as ParticipantListEntryDto[]
    ).filter(({ nickname }) => nickname !== TEST_ORGANIZER_NICKNAME);

  it('crée au démarrage le participant et son compte Organisateur, qui se connecte tout de suite', async () => {
    await restartWithVariables({ pseudo: 'Kaïros', password: PASSWORD });

    const response = await logIn('Kaïros', PASSWORD).expect(200);

    expect(response.body).toEqual({ nickname: 'Kaïros', organizer: true, gameMasterId: null });
    expect((await participants()).map(({ nickname }) => nickname)).toEqual(['Kaïros']);
  });

  it('ne fait rien sans les deux variables', async () => {
    await restartWithVariables({});

    expect(await participants()).toEqual([]);
  });

  it('ajoute le compte au MJ qui porte déjà ce pseudo, comparé comme ID-7, sans second participant', async () => {
    await restartWithVariables({});
    const [elodie] = (
      await request(app!, organizerCookie)
        .post(apiUrl(gameMasterEndpoints.add))
        .send({ nickname: 'Élodie' })
        .expect(201)
    ).body as GameMasterDto[];

    await restartWithVariables({ pseudo: 'elodie', password: PASSWORD });

    const response = await logIn('Élodie', PASSWORD).expect(200);
    expect(response.body).toEqual({
      nickname: 'Élodie',
      organizer: true,
      gameMasterId: elodie!.id,
    });
    expect((await participants()).map(({ nickname }) => nickname)).toEqual(['Élodie']);
  });

  it('ne refait rien au redémarrage avec la même valeur : les sessions restent ouvertes', async () => {
    await restartWithVariables({ pseudo: 'Kaïros', password: PASSWORD });
    const cookie = readSessionCookie(await logIn('Kaïros', PASSWORD).expect(200));

    await restartWithVariables({ pseudo: 'Kaïros', password: PASSWORD });

    await readAccount(cookie).expect(200);
    expect(await participants()).toHaveLength(1);
  });

  it('applique une nouvelle valeur une fois : mot de passe remplacé et sessions fermées', async () => {
    await restartWithVariables({ pseudo: 'Kaïros', password: PASSWORD });
    const cookie = readSessionCookie(await logIn('Kaïros', PASSWORD).expect(200));

    await restartWithVariables({ pseudo: 'Kaïros', password: 'une autre longue phrase' });

    await readAccount(cookie).expect(401);
    await logIn('Kaïros', PASSWORD).expect(401);
    await logIn('Kaïros', 'une autre longue phrase').expect(200);
  });

  it.each([
    ['une seule des deux variables', { pseudo: 'Kaïros' }],
    ['le mot de passe seul', { password: PASSWORD }],
    ['un pseudo fait d’espaces', { pseudo: '   ', password: PASSWORD }],
    ['un mot de passe trop court', { pseudo: 'Kaïros', password: 'court' }],
    ['le pseudo pour mot de passe', { pseudo: 'Kaïros Le Grand', password: 'kairos le grand' }],
  ])('refuse de démarrer avec %s', async (_, variables) => {
    await expect(restartWithVariables(variables)).rejects.toThrow(/ORGANIZER_PSEUDO/);
  });
});
