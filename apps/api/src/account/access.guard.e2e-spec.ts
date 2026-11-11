import { randomUUID } from 'node:crypto';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import type { App } from 'supertest/types.js';
import * as contract from '@chimeres/contract';
import {
  apiUrl,
  frontOfficeEndpoints,
  gameMasterEndpoints,
  scenarioEndpoints,
  type GameMasterSheetDto,
  type ScenarioBody,
} from '@chimeres/contract';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { contractEndpoints, type AnyEndpoint } from './contract-endpoints.js';
import { insertAccountSession, insertGameMasterSession } from '../../test/account-session.js';
import { startApp } from '../../test/app.js';
import { testDatabaseUrl } from '../../test/database.js';
import { request } from '../../test/http.js';

/** L'URL d'un descripteur, chaque paramètre de chemin remplacé par un identifiant inconnu. */
const anyUrl = (descriptor: AnyEndpoint) =>
  `/${contract.API_PREFIX}/${descriptor.path.replace(/:\w+/g, () => randomUUID())}`;

const send = (app: INestApplication<App>, descriptor: AnyEndpoint, cookie?: string) => {
  const client = request(app, cookie);
  const url = anyUrl(descriptor);
  switch (descriptor.method) {
    case 'GET':
      return client.get(url);
    case 'POST':
      return client.post(url);
    case 'PUT':
      return client.put(url);
    case 'PATCH':
      return client.patch(url);
    case 'DELETE':
      return client.delete(url);
  }
};

const closedEndpoints = contractEndpoints.filter(
  ([, { access }]) => access !== 'public' && access !== 'linkedPhone',
);
const organizerEndpoints = contractEndpoints.filter(([, { access }]) => access === 'organizer');

const SCENARIO: ScenarioBody = {
  title: 'Les Brumes',
  system: 'Brumes',
  presentation: 'Une brume, une nuit.',
  contentWarnings: '',
  seats: { min: 3, max: 5 },
  duration: 1,
};

/** Un chemin sans `/` au début ni à la fin, comme ceux des descripteurs. */
const trimSlashes = (path: string) => path.replace(/^\/+|\/+$/g, '');

/**
 * Toutes les routes des controllers de l'application, `MÉTHODE chemin`, chemin du controller
 * compris : ce que le garde doit retrouver parmi les descripteurs.
 */
function listControllerRoutes(app: INestApplication<App>): string[] {
  return [...app.get(ModulesContainer).values()].flatMap((module) =>
    [...module.controllers.values()].flatMap(({ metatype }) => {
      const controller = metatype as unknown as { prototype: Record<string, unknown> };
      const prefix = trimSlashes(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
      return Object.getOwnPropertyNames(controller.prototype).flatMap((name) => {
        const handler = controller.prototype[name] as object;
        const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (name === 'constructor' || path === undefined || method === undefined) return [];
        const fullPath = [prefix, trimSlashes(path)].filter(Boolean).join('/');
        return [`${RequestMethod[method]} ${fullPath}`];
      });
    }),
  );
}

describe('Contrôle d’accès lu sur le descripteur (ADR 0017)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await startApp();
  });

  afterAll(() => app.close());

  it('trouve les descripteurs de contract, de chaque niveau', () => {
    const levels = new Set(contractEndpoints.map(([, { access }]) => access));
    expect(levels).toEqual(
      new Set(['public', 'linkedPhone', 'gameMaster', 'ownGameMaster', 'organizer']),
    );
  });

  it('trouve un descripteur pour chaque route des controllers : aucune ne se ferme sans le dire', () => {
    const described = new Set(contractEndpoints.map(([, { method, path }]) => `${method} ${path}`));
    const routes = listControllerRoutes(app);

    expect(routes.length).toBeGreaterThan(50);
    expect(routes.filter((route) => !described.has(route))).toEqual([]);
  });

  it('trouve une route pour chaque descripteur', () => {
    const routes = new Set(listControllerRoutes(app));

    expect(
      contractEndpoints
        .filter(([, { method, path }]) => !routes.has(`${method} ${path}`))
        .map(([name]) => name),
    ).toEqual([]);
  });

  it('ne trouve qu’un descripteur par route : le garde lit le niveau par méthode et chemin', () => {
    const routes = contractEndpoints.map(([, { method, path }]) => `${method} ${path}`);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it.each(closedEndpoints)('sans session, %s répond 401 (ADR 0017)', async (_, descriptor) => {
    const response = await send(app, descriptor).expect(401);

    expect(response.body).toMatchObject({ code: 'not-logged-in', status: 401 });
  });

  it.each(organizerEndpoints)(
    'avec une session de MJ, %s répond 403 (ADR 0017)',
    async (_, descriptor) => {
      const { cookie } = await insertGameMasterSession('Kaïros');

      const response = await send(app, descriptor, cookie).expect(403);

      expect(response.body).toMatchObject({ code: 'access-denied', status: 403 });
    },
  );

  it('ouvre au MJ la lecture de la convention et des scénarios', async () => {
    const { cookie } = await insertGameMasterSession('Kaïros');

    await request(app, cookie).get(apiUrl(contract.conventionEndpoints.read)).expect(200);
    await request(app, cookie).get(apiUrl(scenarioEndpoints.list)).expect(200);
  });

  describe('ownGameMaster', () => {
    it('ouvre au MJ sa fiche et ses scénarios', async () => {
      const { cookie, gameMasterId } = await insertGameMasterSession('Kaïros');

      const sheet = await request(app, cookie)
        .get(apiUrl(gameMasterEndpoints.read, { gameMasterId }))
        .expect(200);
      expect((sheet.body as GameMasterSheetDto).nickname).toBe('Kaïros');
      await request(app, cookie)
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId }))
        .send(SCENARIO)
        .expect(201);
    });

    it('refuse en 403 un MJ sur le :gameMasterId d’un autre MJ', async () => {
      const { cookie } = await insertGameMasterSession('Kaïros');
      const other = await insertGameMasterSession('Ysolde');

      const response = await request(app, cookie)
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: other.gameMasterId }))
        .send(SCENARIO)
        .expect(403);

      expect(response.body).toMatchObject({ code: 'access-denied' });
      await request(app, cookie)
        .get(apiUrl(gameMasterEndpoints.read, { gameMasterId: other.gameMasterId }))
        .expect(403);
    });

    it('laisse passer un Organisateur sur n’importe quel MJ (PR-13)', async () => {
      const { gameMasterId } = await insertGameMasterSession('Kaïros');
      const organizer = await insertAccountSession();

      await request(app, organizer)
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId }))
        .send(SCENARIO)
        .expect(201);
    });

    it('donne 404 pour le scénario d’un autre MJ sous son propre :gameMasterId (ADR 0017)', async () => {
      const kairos = await insertGameMasterSession('Kaïros');
      const ysolde = await insertGameMasterSession('Ysolde');
      const proposed = await request(app, ysolde.cookie)
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: ysolde.gameMasterId }))
        .send(SCENARIO)
        .expect(201);
      const scenarioId = (proposed.body as { id: string }).id;

      await request(app, kairos.cookie)
        .delete(apiUrl(scenarioEndpoints.remove, { gameMasterId: kairos.gameMasterId, scenarioId }))
        .expect(404);
    });
  });

  it('applique un rôle retiré en base dès la requête suivante (ADR 0017)', async () => {
    const cookie = await insertAccountSession({ nickname: 'Kaïros' });
    await request(app, cookie).get(apiUrl(contract.scheduleEndpoints.read)).expect(200);

    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: testDatabaseUrl }),
    });
    try {
      await prisma.account.updateMany({ data: { organizer: false } });
    } finally {
      await prisma.$disconnect();
    }

    await request(app, cookie).get(apiUrl(contract.scheduleEndpoints.read)).expect(403);
  });

  it('ne donne aucun droit du téléphone relié à une session du back office (ID-3)', async () => {
    const cookie = await insertAccountSession();

    const response = await request(app, cookie)
      .get(apiUrl(frontOfficeEndpoints.readSituation))
      .expect(401);

    expect(response.body).toMatchObject({ code: 'phone-not-linked' });
  });

  it('laisse les routes publiques ouvertes sans session', async () => {
    await request(app).get(apiUrl(contract.healthEndpoints.check)).expect(200);
    await request(app).get(apiUrl(frontOfficeEndpoints.read)).expect(200);
  });
});
