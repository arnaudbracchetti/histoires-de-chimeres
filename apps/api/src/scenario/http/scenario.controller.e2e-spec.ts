import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  gameMasterEndpoints,
  scenarioEndpoints,
  type GameMasterDto,
  type ScenarioBody,
  type ScenarioDto,
  type ScenarioListItemDto,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

const NBSP = '\u00a0';
const UNKNOWN_ID = '8d3c1a8e-0000-4000-8000-000000000000';

const aBody = (changes: Partial<ScenarioBody> = {}): ScenarioBody => ({
  title: "La Tour d'ébène",
  system: "L'Appel de Cthulhu",
  presentation: 'Une tour, une nuit, **un secret**.',
  contentWarnings: '',
  seats: { min: 3, max: 5 },
  duration: 1,
  ...changes,
});

describe('Scénarios', () => {
  let app: INestApplication<App>;
  let gameMaster: GameMasterDto;

  beforeEach(async () => {
    app = await startApp();
    const response = await server()
      .post(apiUrl(gameMasterEndpoints.add))
      .send({ nickname: 'Kaïros' })
      .expect(201);
    gameMaster = (response.body as GameMasterDto[])[0]!;
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const propose = (body: ScenarioBody | object, gameMasterId = gameMaster.id) =>
    server().post(apiUrl(scenarioEndpoints.propose, { gameMasterId })).send(body);
  const read = (scenarioId: string) => server().get(apiUrl(scenarioEndpoints.read, { scenarioId }));
  const update = (scenarioId: string, body: ScenarioBody | object) =>
    server().put(apiUrl(scenarioEndpoints.update, { scenarioId })).send(body);
  const list = async () =>
    (await server().get(apiUrl(scenarioEndpoints.list)).expect(200)).body as ScenarioListItemDto[];
  const remove = (scenarioId: string) =>
    server().delete(apiUrl(scenarioEndpoints.remove, { scenarioId }));
  const removeGameMaster = (gameMasterId = gameMaster.id) =>
    server().delete(apiUrl(gameMasterEndpoints.remove, { gameMasterId }));
  const readGameMaster = async () =>
    (
      await server()
        .get(apiUrl(gameMasterEndpoints.read, { gameMasterId: gameMaster.id }))
        .expect(200)
    ).body as GameMasterDto;

  it('propose un scénario pour un MJ, et le renvoie avec son MJ (PR-1, PR-16)', async () => {
    const response = await propose(
      aBody({ title: "  La Tour d'ébène ", contentWarnings: 'Folie', duration: 2 }),
    ).expect(201);

    const scenario = response.body as ScenarioDto;
    expect(scenario).toEqual({
      id: expect.any(String),
      gameMaster: { id: gameMaster.id, nickname: 'Kaïros' },
      title: "La Tour d'ébène",
      system: "L'Appel de Cthulhu",
      presentation: 'Une tour, une nuit, **un secret**.',
      contentWarnings: 'Folie',
      seats: { min: 3, max: 5 },
      duration: 2,
      imageUrl: null,
    });
    expect((await read(scenario.id).expect(200)).body).toEqual(scenario);
  });

  it('la fiche du MJ liste ses scénarios, dans l’ordre naturel de leur titre', async () => {
    await propose(aBody({ title: 'Scénario 10' })).expect(201);
    const { body: second } = await propose(
      aBody({ title: 'Scénario 2', seats: { min: 1, max: 4 } }),
    ).expect(201);

    const { scenarios } = await readGameMaster();

    expect(scenarios.map(({ title }) => title)).toEqual(['Scénario 2', 'Scénario 10']);
    expect(scenarios[0]).toEqual({
      id: (second as ScenarioDto).id,
      title: 'Scénario 2',
      system: "L'Appel de Cthulhu",
      seats: { min: 1, max: 4 },
      duration: 1,
      imageUrl: null,
    });
  });

  it('modifie le contenu, les places et la durée, et renvoie le scénario (PR-14)', async () => {
    const { body: proposed } = await propose(aBody()).expect(201);
    const { id } = proposed as ScenarioDto;

    const response = await update(
      id,
      aBody({
        title: 'Les Chiens de la Vigne',
        system: 'Dogs in the Vineyard',
        presentation: '- un\n- deux',
        contentWarnings: 'Violence',
        seats: { min: 2, max: 2 },
        duration: 2,
      }),
    ).expect(200);

    expect(response.body).toMatchObject({
      id,
      gameMaster: { id: gameMaster.id },
      title: 'Les Chiens de la Vigne',
      system: 'Dogs in the Vineyard',
      presentation: '- un\n- deux',
      contentWarnings: 'Violence',
      seats: { min: 2, max: 2 },
      duration: 2,
    });
    expect((await read(id).expect(200)).body).toEqual(response.body);
  });

  it.each([
    ['un titre vide', { title: ' ' }, 'scenario-title-required', 'title'],
    ['un titre de 81 caractères', { title: 'a'.repeat(81) }, 'scenario-title-too-long', 'title'],
    ['un jeu vide', { system: '' }, 'system-required', 'system'],
    ['un jeu de 61 caractères', { system: 'a'.repeat(61) }, 'system-too-long', 'system'],
    ['une présentation vide', { presentation: '' }, 'presentation-required', 'presentation'],
    [
      'une présentation de 1 501 caractères',
      { presentation: 'a'.repeat(1501) },
      'presentation-too-long',
      'presentation',
    ],
    [
      'des avertissements de 301 caractères',
      { contentWarnings: 'a'.repeat(301) },
      'content-warnings-too-long',
      'contentWarnings',
    ],
    ['un minimum de 0', { seats: { min: 0, max: 3 } }, 'seats-min-below-one', 'seats.min'],
    [
      'des places dans le désordre',
      { seats: { min: 5, max: 3 } },
      'seats-out-of-order',
      'seats.max',
    ],
  ])('refuse %s : 422, rattaché à son champ', async (_, changes, code, field) => {
    const response = await propose(aBody(changes))
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ code, errors: [{ field, code }] });
    expect((await readGameMaster()).scenarios).toEqual([]);
  });

  it('refuse une modification hors bornes, et garde le scénario', async () => {
    const { body: proposed } = await propose(aBody()).expect(201);
    const { id } = proposed as ScenarioDto;

    const response = await update(id, aBody({ title: '', seats: { min: 1, max: 9 } })).expect(422);

    expect(response.body).toMatchObject({ code: 'scenario-title-required' });
    expect((await read(id).expect(200)).body).toEqual(proposed);
  });

  it('liste tous les scénarios, dans l’ordre naturel de leur titre, avec leur MJ', async () => {
    const { body: other } = await server()
      .post(apiUrl(gameMasterEndpoints.add))
      .send({ nickname: 'Élodie' })
      .expect(201);
    const elodie = (other as GameMasterDto[]).find(({ nickname }) => nickname === 'Élodie')!;
    await propose(aBody({ title: 'Scénario 10' })).expect(201);
    await propose(aBody({ title: 'Scénario 2', seats: { min: 2, max: 4 } }), elodie.id).expect(201);

    const scenarios = await list();

    expect(scenarios.map(({ title }) => title)).toEqual(['Scénario 2', 'Scénario 10']);
    expect(scenarios[0]).toEqual({
      id: expect.any(String),
      title: 'Scénario 2',
      system: "L'Appel de Cthulhu",
      seats: { min: 2, max: 4 },
      duration: 1,
      imageUrl: null,
      gameMaster: { id: elodie.id, nickname: 'Élodie' },
      games: 0,
    });
  });

  it('supprime un scénario (PR-14)', async () => {
    const { body } = await propose(aBody()).expect(201);
    const { id } = body as ScenarioDto;

    await remove(id).expect(204);

    expect(await list()).toEqual([]);
    await read(id).expect(404);
  });

  it('refuse de supprimer un MJ qui a un scénario, et le garde (PR-12)', async () => {
    await propose(aBody()).expect(201);

    const response = await removeGameMaster()
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      code: 'game-master-has-scenarios',
      detail: `Ce MJ a un scénario${NBSP}: supprime-le d'abord.`,
    });
    expect((await readGameMaster()).nickname).toBe('Kaïros');
  });

  it('supprime un MJ dont le scénario a été supprimé', async () => {
    const { body } = await propose(aBody()).expect(201);
    await remove((body as ScenarioDto).id).expect(204);

    await removeGameMaster().expect(204);
  });

  it.each([
    ['proposer un scénario pour un', () => propose(aBody(), UNKNOWN_ID), 'game-master-not-found'],
    [
      'proposer un scénario, par un identifiant mal formé, pour un',
      () => propose(aBody(), 'abc'),
      'game-master-not-found',
    ],
    ['lire un', () => read(UNKNOWN_ID), 'scenario-not-found'],
    ['lire, par un identifiant mal formé, un', () => read('abc'), 'scenario-not-found'],
    ['modifier un', () => update(UNKNOWN_ID, aBody()), 'scenario-not-found'],
    [
      'modifier, par un identifiant mal formé, un',
      () => update('abc', aBody()),
      'scenario-not-found',
    ],
    ['supprimer un', () => remove(UNKNOWN_ID), 'scenario-not-found'],
    ['supprimer, par un identifiant mal formé, un', () => remove('abc'), 'scenario-not-found'],
  ])('répond 404 pour %s élément inconnu', async (_, action, code) => {
    const response = await action()
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ status: 404, code });
  });

  it.each([
    ['une durée de 3 créneaux', aBody({ duration: 3 as 1 })],
    ['des places non entières', aBody({ seats: { min: 1.5, max: 3 } })],
    ['des places manquantes', { ...aBody(), seats: undefined }],
    ['un champ en trop', { ...aBody(), gameMasterId: 'x' }],
  ])('refuse %s : 400 malformed-request', async (_, body) => {
    const response = await propose(body).expect(400);

    expect(response.body).toMatchObject({ code: 'malformed-request' });
  });
});
