import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import webpush from 'web-push';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  gameMasterEndpoints,
  linkedPhoneEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  signUpEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type IdentityConfirmationDto,
  type PushSubscriptionBody,
  type ScenarioDto,
  type ScheduleDto,
} from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';
import { startApp } from '../../../test/app.js';
import { FakePushService, type ReceivedPush } from '../../../test/fake-push-service.js';

const PUBLIC_URL = 'https://chimeres.example.org';
const FOUR_WEEKS = 4 * 7 * 24 * 3600;

/** Un délai où un envoi aurait eu le temps d'arriver : pour vérifier que rien ne part. */
const quietPeriod = () => new Promise((resolve) => setTimeout(resolve, 300));

describe('Notifications des gestes de programmation et des inscriptions (NO-2, ADR 0010)', () => {
  let app: INestApplication<App>;
  let push: FakePushService;
  let convention: ConventionDto;
  /** « Néons » d'Élodie, au créneau 1 (9 h – 11 h 30), table Griffon, de 3 à 5 places. */
  let gameId: string;
  let scenario: ScenarioDto;
  let gameMasterId: string;
  /** Les abonnements des téléphones reliés à Lune, inscrite à « Néons », à Sven, et à Élodie, MJ. */
  let lune: PushSubscriptionBody;
  let sven: PushSubscriptionBody;
  let elodie: PushSubscriptionBody;
  let lunePhone: string;
  let svenPhone: string;

  const server = () => request(app.getHttpServer());

  /**
   * Relie un téléphone au pseudo et range son abonnement : son cookie, `nom=valeur`. L'endpoint du
   * faux service push est en HTTP, que l'API refuse d'un téléphone : il est rangé en base.
   */
  const linkPhone = async (
    nickname: string,
    subscription: PushSubscriptionBody,
    confirmation: IdentityConfirmationDto | null = null,
  ) => {
    const response = await server()
      .post(apiUrl(linkedPhoneEndpoints.link))
      .send({ presenceCode: convention.presenceCode, nickname, confirmation })
      .expect(200);
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    await app.get(PrismaService).linkedPhone.update({
      where: { id: decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1)) },
      data: {
        pushEndpoint: subscription.endpoint,
        pushP256dh: subscription.keys.p256dh,
        pushAuth: subscription.keys.auth,
      },
    });
    return cookie;
  };

  const setDate = (date: string | null) =>
    server()
      .put(apiUrl(conventionEndpoints.update))
      .send({ name: convention.name, date })
      .expect(200);

  const unschedule = (id = gameId) =>
    server()
      .delete(apiUrl(scheduleEndpoints.unschedule, { gameId: id }))
      .expect(200);

  const signUp = (cookie: string) =>
    server().put(apiUrl(signUpEndpoints.signUp, { gameId })).set('Cookie', cookie).expect(204);

  /** Fixe les places de « Néons » : de 1 à `max`. */
  const changeMaxSeats = (max: number) =>
    server()
      .put(apiUrl(scenarioEndpoints.update, { scenarioId: scenario.id }))
      .send({
        title: scenario.title,
        system: scenario.system,
        presentation: scenario.presentation,
        contentWarnings: scenario.contentWarnings,
        seats: { min: 1, max },
        duration: scenario.duration,
      })
      .expect(200);

  const slot = (rank: number) => convention.timeSlots[rank - 1]!.id;

  /** Programme « Songe » d'Élodie, au créneau 2, table Griffon : l'id de la partie. */
  const scheduleSonge = async () => {
    const songe = (
      await server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId }))
        .send({
          title: 'Songe',
          system: 'Rêve de dragon',
          presentation: 'Un rêve.',
          contentWarnings: '',
          seats: { min: 3, max: 5 },
          duration: 1,
        })
        .expect(201)
    ).body as ScenarioDto;
    const scheduled = (
      await server()
        .post(apiUrl(scheduleEndpoints.schedule))
        .send({ scenarioId: songe.id, timeSlotId: slot(2), tableId: convention.tables[0]!.id })
        .expect(201)
    ).body as ScheduleDto;
    return scheduled.games.find(({ scenario }) => scenario.id === songe.id)!.id;
  };

  const filterReceivedBySubscription = (
    received: ReceivedPush[],
    subscription: PushSubscriptionBody,
  ) => received.filter(({ endpoint }) => endpoint === subscription.endpoint);

  const startWithPush = async () => {
    vi.stubEnv('VAPID_PUBLIC_KEY', vapidKeys.publicKey);
    vi.stubEnv('VAPID_PRIVATE_KEY', vapidKeys.privateKey);
    vi.stubEnv('VAPID_SUBJECT', 'mailto:organisateurs@example.org');
    vi.stubEnv('PUBLIC_URL', PUBLIC_URL);
    app = await startApp();
  };

  const vapidKeys = webpush.generateVAPIDKeys();

  /** La convention, son MJ, sa partie et ses téléphones, l'application démarrée par `start`. */
  const prepare = async (start: () => Promise<void>) => {
    push = await FakePushService.start();
    await start();
    for (const start of ['09:00', '14:00']) {
      await server()
        .post(apiUrl(timeSlotEndpoints.add))
        .send({ start, end: start.replace(/^(\d\d):00/, (_, h) => `${Number(h) + 2}:30`) })
        .expect(201);
    }
    convention = (await server().post(apiUrl(tableEndpoints.add)).send({ name: 'Griffon' }))
      .body as ConventionDto;
    const [gameMaster] = (
      await server().post(apiUrl(gameMasterEndpoints.add)).send({ nickname: 'Élodie' }).expect(201)
    ).body as GameMasterDto[];
    gameMasterId = gameMaster!.id;
    for (const timeSlotId of [slot(1), slot(2)]) {
      await server()
        .put(apiUrl(availabilityEndpoints.declare, { gameMasterId: gameMaster!.id, timeSlotId }))
        .expect(200);
    }
    scenario = (
      await server()
        .post(apiUrl(scenarioEndpoints.propose, { gameMasterId: gameMaster!.id }))
        .send({
          title: 'Néons',
          system: 'Cthulhu',
          presentation: 'Une enquête.',
          contentWarnings: '',
          seats: { min: 3, max: 5 },
          duration: 1,
        })
        .expect(201)
    ).body as ScenarioDto;
    const scheduled = (
      await server()
        .post(apiUrl(scheduleEndpoints.schedule))
        .send({ scenarioId: scenario.id, timeSlotId: slot(1), tableId: convention.tables[0]!.id })
        .expect(201)
    ).body as ScheduleDto;
    gameId = scheduled.games[0]!.id;
    [lune, sven, elodie] = [push.subscription(), push.subscription(), push.subscription()];
    lunePhone = await linkPhone('Lune', lune);
    svenPhone = await linkPhone('Sven', sven);
    await linkPhone('Élodie', elodie, 'game-master');
    await server()
      .put(apiUrl(signUpEndpoints.signUp, { gameId }))
      .set('Cookie', lunePhone)
      .expect(204);
  };

  afterEach(async () => {
    await app.close();
    await push.stop();
    vi.unstubAllEnvs();
  });

  describe('avec les clés VAPID', () => {
    beforeEach(() => prepare(startWithPush));

    it('une partie déprogrammée prévient ses inscrits et son MJ, en un JSON déclaratif', async () => {
      await unschedule();

      const received = await push.receivedAtLeast(2);
      expect(filterReceivedBySubscription(received, sven)).toEqual([]);
      const tap = '/programme?creneau=1';
      expect(filterReceivedBySubscription(received, lune).map(({ message }) => message)).toEqual([
        {
          web_push: 8030,
          notification: {
            title: 'Créneau 1\u00a0: partie retirée du programme',
            body: 'Néons est retirée\u00a0: ton inscription est supprimée.',
            navigate: `${PUBLIC_URL}${tap}`,
            lang: 'fr',
            icon: `${PUBLIC_URL}/icons/icon-192.png`,
            badge: `${PUBLIC_URL}/icons/badge-96.png`,
            data: {
              onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: tap } },
            },
          },
        },
      ]);
      expect(filterReceivedBySubscription(received, elodie).map(({ message }) => message)).toEqual([
        expect.objectContaining({
          notification: expect.objectContaining({
            title: 'Créneau 1\u00a0: partie retirée du programme',
            body: "Néons est retirée\u00a0: tu peux t'inscrire sur ce créneau.",
          }),
        }),
      ]);
    });

    it('chiffre, signe, et envoie en urgence, 4 semaines tant que la convention n’a pas de date', async () => {
      await unschedule();

      const [{ headers }] = filterReceivedBySubscription(await push.receivedAtLeast(2), lune) as [
        ReceivedPush,
      ];
      expect(headers).toMatchObject({
        ttl: String(FOUR_WEEKS),
        urgency: 'high',
        'content-encoding': 'aes128gcm',
        'content-type': 'application/octet-stream',
      });
      expect(headers.authorization).toMatch(new RegExp(`^vapid t=.+, k=${vapidKeys.publicKey}$`));
    });

    it('limite le TTL à la fin du créneau concerné (NO-3)', async () => {
      await setDate('2099-01-15');

      await unschedule();

      const [{ headers }] = filterReceivedBySubscription(await push.receivedAtLeast(2), lune) as [
        ReceivedPush,
      ];
      const expected = (Date.parse('2099-01-15T11:30:00+01:00') - Date.now()) / 1000;
      expect(Math.abs(Number(headers.ttl) - expected)).toBeLessThan(10);
    });

    it('n’envoie rien après la fin du créneau concerné (NO-3)', async () => {
      await setDate('2020-01-15');
      await unschedule();
      await quietPeriod();

      expect(push.received).toEqual([]);
    });

    it('une partie passée à un autre créneau prévient ses inscrits, et le tap ouvre sa fiche', async () => {
      await server()
        .put(apiUrl(scheduleEndpoints.move, { gameId }))
        .send({ timeSlotId: slot(2), tableId: convention.tables[0]!.id })
        .expect(200);

      const received = await push.receivedAtLeast(3);
      expect(received.map(({ endpoint }) => endpoint).sort()).toEqual(
        [lune.endpoint, sven.endpoint, elodie.endpoint].sort(),
      );
      const [{ message }] = filterReceivedBySubscription(received, lune) as [ReceivedPush];
      expect(message).toMatchObject({
        notification: {
          title: 'Créneau 1\u00a0: partie déplacée',
          body: "Néons passe au créneau 2\u00a0: ton inscription est retirée. Réinscris-toi si l'horaire te va.",
          navigate: `${PUBLIC_URL}/parties/${gameId}`,
          data: {
            onActionClick: {
              default: { operation: 'navigateLastFocusedOrOpen', url: `/parties/${gameId}` },
            },
          },
        },
      });
      expect(filterReceivedBySubscription(received, sven)[0]).toMatchObject({
        message: { notification: { title: 'Créneau 2\u00a0: nouvelle partie' } },
      });
      expect(filterReceivedBySubscription(received, elodie)[0]).toMatchObject({
        message: { notification: { title: 'Créneau 2\u00a0: tu mènes une partie' } },
      });
    });

    describe('partie programmée (NO-2)', () => {
      it('prévient tout le monde d’une nouvelle partie, qui remplace celles du créneau sans son', async () => {
        const songeId = await scheduleSonge();

        const received = await push.receivedAtLeast(3);
        await quietPeriod();
        expect(push.received).toHaveLength(3);
        for (const subscription of [lune, sven]) {
          const [{ message, headers }] = filterReceivedBySubscription(received, subscription) as [
            ReceivedPush,
          ];
          expect(message).toMatchObject({
            notification: {
              title: 'Créneau 2\u00a0: nouvelle partie',
              body: "Songe · Rêve de dragon, table Griffon. Tu peux t'y inscrire.",
              navigate: `${PUBLIC_URL}/parties/${songeId}`,
              tag: 'new-game-2',
              renotify: false,
            },
          });
          expect(headers.topic).toBe('new-game-2');
        }
      });

      it('prévient son MJ qu’il la mène, et le tap ouvre Mes parties sur ce créneau', async () => {
        await scheduleSonge();

        const received = await push.receivedAtLeast(3);
        const [{ message, headers }] = filterReceivedBySubscription(received, elodie) as [
          ReceivedPush,
        ];
        expect(message).toMatchObject({
          notification: {
            title: 'Créneau 2\u00a0: tu mènes une partie',
            body: 'Songe, table Griffon, 14\u00a0h\u00a000\u202f–\u202f16\u00a0h\u00a030.',
            navigate: `${PUBLIC_URL}/mes-parties?creneau=2`,
          },
        });
        expect(message).not.toHaveProperty('notification.tag');
        expect(headers.topic).toBeUndefined();
      });

      it('n’envoie rien après la fin de son créneau (NO-3)', async () => {
        await setDate('2020-01-15');

        await scheduleSonge();
        await quietPeriod();

        expect(push.received).toEqual([]);
      });
    });

    it('va au pseudo relié au moment de l’envoi (NO-1)', async () => {
      await server()
        .delete(apiUrl(linkedPhoneEndpoints.unlink))
        .set('Cookie', lunePhone)
        .expect(204);
      await linkPhone('Zoé', lune);

      await unschedule();

      await push.receivedAtLeast(1);
      await quietPeriod();
      expect(push.received.map(({ endpoint }) => endpoint)).toEqual([elodie.endpoint]);
    });

    it.each([404, 410])(
      'un %i efface l’abonnement, et le téléphone reste relié',
      async (status) => {
        push.respondWith(lune.endpoint, status);

        await unschedule();

        await push.receivedAtLeast(2);
        const prisma = app.get(PrismaService);
        await vi.waitFor(async () => {
          const phone = await prisma.linkedPhone.findFirst({
            where: { participant: { nickname: 'Lune' } },
          });
          expect(phone).toMatchObject({ pushEndpoint: null, pushP256dh: null, pushAuth: null });
        });
      },
    );

    it('retente une fois sur une erreur du service push', async () => {
      push.respondWith(lune.endpoint, 503, 503);

      await unschedule();

      await push.receivedAtLeast(3);
      await quietPeriod();
      expect(filterReceivedBySubscription(push.received, lune)).toHaveLength(2);
    });

    describe('partie très demandée (IN-5)', () => {
      const oversubscribed = {
        title: 'Créneau 1\u00a0: partie très demandée',
        body: "Néons est une partie très demandée, et c'est ta seule inscription sur ce créneau. Inscris-toi à d'autres parties pour éviter de te retrouver sans table où jouer.",
        navigate: `${PUBLIC_URL}/programme?creneau=1`,
        tag: 'oversubscribed-1',
        renotify: true,
      };

      it('une inscription qui la fait passer au-dessus de ses places prévient les autres inscrits', async () => {
        await changeMaxSeats(1);
        await quietPeriod();

        await signUp(svenPhone);

        const [{ message, headers }] = (await push.receivedAtLeast(1)) as [ReceivedPush];
        await quietPeriod();
        expect(push.received.map(({ endpoint }) => endpoint)).toEqual([lune.endpoint]);
        expect(message).toMatchObject({ notification: oversubscribed });
        expect(headers.topic).toBe('oversubscribed-1');
      });

      it('une baisse des places de son scénario prévient ses inscrits', async () => {
        await signUp(svenPhone);

        await changeMaxSeats(1);

        const received = await push.receivedAtLeast(2);
        expect(received.map(({ endpoint }) => endpoint).sort()).toEqual(
          [lune.endpoint, sven.endpoint].sort(),
        );
        expect(filterReceivedBySubscription(received, sven)[0]).toMatchObject({
          message: { notification: oversubscribed },
          headers: { topic: 'oversubscribed-1' },
        });
      });
    });

    it('le geste répond sans attendre l’envoi', async () => {
      const release = push.hold();

      await unschedule();

      await push.receivedAtLeast(2);
      release();
    });
  });

  describe('sans clés VAPID', () => {
    beforeEach(() =>
      prepare(async () => {
        vi.stubEnv('VAPID_PUBLIC_KEY', '');
        vi.stubEnv('VAPID_PRIVATE_KEY', '');
        vi.stubEnv('VAPID_SUBJECT', '');
        app = await startApp();
      }),
    );

    it('le geste réussit, et rien ne part', async () => {
      await unschedule();
      await quietPeriod();

      expect(push.received).toEqual([]);
    });
  });
});
