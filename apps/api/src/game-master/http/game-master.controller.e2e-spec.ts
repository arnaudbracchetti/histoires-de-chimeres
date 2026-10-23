import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  gameMasterEndpoints,
  type GameMasterDto,
  type GameMasterNicknameBody,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

const UNKNOWN_ID = '8d3c1a8e-0000-4000-8000-000000000000';

describe('MJ', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const list = async () =>
    (await server().get(apiUrl(gameMasterEndpoints.list)).expect(200)).body as GameMasterDto[];
  const read = (gameMasterId: string) =>
    server().get(apiUrl(gameMasterEndpoints.read, { gameMasterId }));
  const add = (body: GameMasterNicknameBody | object) =>
    server().post(apiUrl(gameMasterEndpoints.add)).send(body);
  const rename = (gameMasterId: string, body: GameMasterNicknameBody | object) =>
    server().put(apiUrl(gameMasterEndpoints.rename, { gameMasterId })).send(body);
  const remove = (gameMasterId: string) =>
    server().delete(apiUrl(gameMasterEndpoints.remove, { gameMasterId }));
  const nicknamesOf = (gameMasters: GameMasterDto[]) => gameMasters.map(({ nickname }) => nickname);
  const idOf = async (nickname: string) =>
    (await list()).find((gameMaster) => gameMaster.nickname === nickname)!.id;

  it('la convention n’a d’abord aucun MJ', async () => {
    expect(await list()).toEqual([]);
  });

  it('crée des MJ, renvoyés dans l’ordre naturel de leur pseudo', async () => {
    await add({ nickname: 'Kaïros' }).expect(201);
    const response = await add({ nickname: '  Élodie ' }).expect(201);

    expect(nicknamesOf(response.body)).toEqual(['Élodie', 'Kaïros']);
    expect(response.body).toEqual(await list());
  });

  it('lit la fiche d’un MJ, avec son pseudo tel qu’il a été saisi', async () => {
    await add({ nickname: 'Élodie' }).expect(201);
    const id = await idOf('Élodie');

    const response = await read(id).expect(200);

    expect(response.body).toEqual({ id, nickname: 'Élodie' });
  });

  it('refuse « elodie » quand « Élodie » existe : 422, rattaché au pseudo (ID-7)', async () => {
    await add({ nickname: 'Élodie' }).expect(201);

    const response = await add({ nickname: 'elodie' })
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      code: 'nickname-taken',
      title: 'Pseudo déjà pris',
      errors: [{ field: 'nickname', code: 'nickname-taken' }],
    });
    expect(response.body.detail).toContain('« Élodie »');
    expect(nicknamesOf(await list())).toEqual(['Élodie']);
  });

  it('accepte « Jean Luc » à côté de « Jean-Luc » : la ponctuation compte', async () => {
    await add({ nickname: 'Jean-Luc' }).expect(201);

    const response = await add({ nickname: 'Jean Luc' }).expect(201);

    expect(nicknamesOf(response.body)).toEqual(['Jean Luc', 'Jean-Luc']);
  });

  it.each([
    ['vide', '  ', 'nickname-required'],
    ['de 31 caractères', 'a'.repeat(31), 'nickname-too-long'],
  ])('refuse un pseudo %s : 422, rattaché au pseudo', async (_, nickname, code) => {
    const response = await add({ nickname }).expect(422);

    expect(response.body).toMatchObject({ code, errors: [{ field: 'nickname', code }] });
  });

  it.each([
    ['vide', '  ', 'nickname-required'],
    ['de 31 caractères', 'a'.repeat(31), 'nickname-too-long'],
  ])('refuse de changer le pseudo en un pseudo %s : 422', async (_, nickname, code) => {
    await add({ nickname: 'Élodie' }).expect(201);

    const response = await rename(await idOf('Élodie'), { nickname }).expect(422);

    expect(response.body).toMatchObject({ code, errors: [{ field: 'nickname', code }] });
    expect(nicknamesOf(await list())).toEqual(['Élodie']);
  });

  it('change le pseudo d’un MJ, et renvoie sa fiche', async () => {
    await add({ nickname: 'Élodie' }).expect(201);
    const id = await idOf('Élodie');

    const response = await rename(id, { nickname: 'Élodie la Rouge' }).expect(200);

    expect(response.body).toEqual({ id, nickname: 'Élodie la Rouge' });
    expect((await read(id).expect(200)).body).toEqual(response.body);
  });

  it('refuse de donner à un MJ le pseudo d’un autre', async () => {
    await add({ nickname: 'Élodie' }).expect(201);
    await add({ nickname: 'Kaïros' }).expect(201);

    const response = await rename(await idOf('Kaïros'), { nickname: 'ÉLODIE' }).expect(422);

    expect(response.body).toMatchObject({ code: 'nickname-taken' });
    expect(nicknamesOf(await list())).toEqual(['Élodie', 'Kaïros']);
  });

  it('supprime un MJ', async () => {
    await add({ nickname: 'Élodie' }).expect(201);
    await add({ nickname: 'Kaïros' }).expect(201);
    const id = await idOf('Élodie');

    await remove(id).expect(204);

    expect(nicknamesOf(await list())).toEqual(['Kaïros']);
    await read(id).expect(404);
  });

  it.each([
    ['lire la fiche d’un', () => read(UNKNOWN_ID)],
    ['lire la fiche, par un identifiant mal formé, d’un', () => read('abc')],
    ['changer le pseudo d’un', () => rename(UNKNOWN_ID, { nickname: 'Alix' })],
    ['supprimer un', () => remove(UNKNOWN_ID)],
  ])('répond 404 game-master-not-found pour %s MJ inconnu', async (_, action) => {
    const response = await action()
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ status: 404, code: 'game-master-not-found' });
  });

  it.each([
    ['un pseudo qui n’est pas un texte', { nickname: 42 }],
    ['un pseudo manquant', {}],
    ['un champ en trop', { nickname: 'Élodie', id: 'x' }],
  ])('refuse %s : 400 malformed-request', async (_, body) => {
    const response = await add(body).expect(400);

    expect(response.body).toMatchObject({ code: 'malformed-request' });
  });
});
