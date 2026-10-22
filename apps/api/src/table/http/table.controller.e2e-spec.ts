import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  conventionEndpoints,
  tableEndpoints,
  type ConventionDto,
  type TableNameBody,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Tables', () => {
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
  const add = (body: TableNameBody | object) =>
    server().post(apiUrl(tableEndpoints.add)).send(body);
  const rename = (tableId: string, body: TableNameBody | object) =>
    server().put(apiUrl(tableEndpoints.rename, { tableId })).send(body);
  const remove = (tableId: string) => server().delete(apiUrl(tableEndpoints.remove, { tableId }));
  const namesOf = ({ tables }: ConventionDto) => tables.map(({ name }) => name);
  const idOf = async (name: string) => (await read()).tables.find((t) => t.name === name)!.id;

  it('la convention n’a d’abord aucune table', async () => {
    expect((await read()).tables).toEqual([]);
  });

  it('ajoute des tables, renvoyées dans l’ordre naturel', async () => {
    for (const name of ['Table 10', 'Table 2', 'Dragon']) {
      await add({ name }).expect(201);
    }
    const response = await add({ name: '  Table 1 ' }).expect(201);

    expect(namesOf(response.body)).toEqual(['Dragon', 'Table 1', 'Table 2', 'Table 10']);
    expect(response.body).toEqual(await read());
    expect((await read()).tables[0]).toEqual({ id: expect.any(String), name: 'Dragon' });
  });

  it('refuse un nom pris, à la casse et aux accents près : 422, rattaché au nom (PR-9)', async () => {
    await add({ name: 'Dragon' }).expect(201);

    const response = await add({ name: ' dragón ' })
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      code: 'table-name-taken',
      title: 'Nom déjà pris',
      errors: [{ field: 'name', code: 'table-name-taken' }],
    });
    expect(response.body.detail).toContain('« Dragon »');
    expect(namesOf(await read())).toEqual(['Dragon']);
  });

  it.each([
    ['vide', '  ', 'table-name-required'],
    ['de 31 caractères', 'a'.repeat(31), 'table-name-too-long'],
  ])('refuse un nom %s : 422, rattaché au nom', async (_, name, code) => {
    const response = await add({ name }).expect(422);

    expect(response.body).toMatchObject({ code, errors: [{ field: 'name', code }] });
  });

  it('renomme une table, qui reprend sa place dans l’ordre naturel', async () => {
    await add({ name: 'Table 1' }).expect(201);
    await add({ name: 'Table 2' }).expect(201);

    const response = await rename(await idOf('Table 1'), { name: 'Table 3' }).expect(200);

    expect(namesOf(response.body)).toEqual(['Table 2', 'Table 3']);
  });

  it('refuse de renommer une table du nom d’une autre', async () => {
    await add({ name: 'Dragon' }).expect(201);
    await add({ name: 'Licorne' }).expect(201);

    const response = await rename(await idOf('Licorne'), { name: 'DRAGON' }).expect(422);

    expect(response.body).toMatchObject({ code: 'table-name-taken' });
    expect(namesOf(await read())).toEqual(['Dragon', 'Licorne']);
  });

  it('supprime une table', async () => {
    await add({ name: 'Dragon' }).expect(201);
    await add({ name: 'Licorne' }).expect(201);

    const response = await remove(await idOf('Dragon')).expect(200);

    expect(namesOf(response.body)).toEqual(['Licorne']);
    expect(namesOf(await read())).toEqual(['Licorne']);
  });

  it.each([
    ['la renommer', (id: string) => rename(id, { name: 'Dragon' })],
    ['la supprimer', (id: string) => remove(id)],
  ])('répond 404 table-not-found pour %s d’une table inconnue', async (_, action) => {
    const response = await action('8d3c1a8e-0000-4000-8000-000000000000')
      .expect(404)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({ status: 404, code: 'table-not-found' });
  });

  it.each([
    ['un nom qui n’est pas un texte', { name: 42 }],
    ['un nom manquant', {}],
    ['un champ en trop', { name: 'Dragon', id: 'x' }],
  ])('refuse %s : 400 malformed-request', async (_, body) => {
    const response = await add(body).expect(400);

    expect(response.body).toMatchObject({ code: 'malformed-request' });
  });
});
