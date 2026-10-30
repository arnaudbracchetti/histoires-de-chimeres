import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  conventionEndpoints,
  linkedPhoneEndpoints,
  pushSubscriptionEndpoints,
  type ConventionDto,
  type PushSubscriptionBody,
} from '@chimeres/contract';
import { PrismaService } from '../../prisma/prisma.service.js';
import { startApp } from '../../../test/app.js';

describe('Abonnement push du téléphone relié', () => {
  let app: INestApplication<App>;

  afterEach(async () => {
    await app.close();
    vi.unstubAllEnvs();
  });

  const server = () => request(app.getHttpServer());

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

  const save = (body: PushSubscriptionBody, cookie?: string) => {
    const call = server().put(apiUrl(pushSubscriptionEndpoints.save)).send(body);
    return cookie ? call.set('Cookie', cookie) : call;
  };

  const subscription = (endpoint: string): PushSubscriptionBody => ({
    endpoint,
    keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHItJI5svbpez7KI4CCXg' },
  });

  /** Les abonnements rangés, par pseudo : on les lit en base, faute d'endpoint qui les montre. */
  const endpointsByNickname = async () => {
    const phones = await app.get(PrismaService).linkedPhone.findMany({
      select: { pushEndpoint: true, participant: { select: { nickname: true } } },
    });
    return Object.fromEntries(
      phones.map(({ pushEndpoint, participant }) => [participant.nickname, pushEndpoint]),
    );
  };

  describe('ranger l’abonnement', () => {
    beforeEach(async () => {
      app = await startApp();
    });

    it('le range sur le téléphone relié, sans effet si on le répète', async () => {
      const phone = await linkedPhone('Élodie');

      await save(subscription('https://push.example/a'), phone).expect(204);
      await save(subscription('https://push.example/a'), phone).expect(204);

      expect(await endpointsByNickname()).toEqual({ Élodie: 'https://push.example/a' });
    });

    it('remplace l’abonnement précédent du téléphone', async () => {
      const phone = await linkedPhone('Élodie');
      await save(subscription('https://push.example/a'), phone).expect(204);

      await save(subscription('https://push.example/b'), phone).expect(204);

      expect(await endpointsByNickname()).toEqual({ Élodie: 'https://push.example/b' });
    });

    it('l’enlève d’un autre téléphone : un endpoint n’appartient qu’à un téléphone relié', async () => {
      const elodie = await linkedPhone('Élodie');
      const brann = await linkedPhone('Brann');
      await save(subscription('https://push.example/a'), elodie).expect(204);

      await save(subscription('https://push.example/a'), brann).expect(204);

      expect(await endpointsByNickname()).toEqual({
        Élodie: null,
        Brann: 'https://push.example/a',
      });
    });

    it('refuse un téléphone relié à aucun pseudo : 401 phone-not-linked', async () => {
      const response = await save(subscription('https://push.example/a')).expect(401);

      expect(response.body).toMatchObject({ code: 'phone-not-linked' });
    });

    it('refuse un corps sans clés : 400 malformed-request', async () => {
      const phone = await linkedPhone('Élodie');

      const response = await server()
        .put(apiUrl(pushSubscriptionEndpoints.save))
        .set('Cookie', phone)
        .send({ endpoint: 'https://push.example/a' })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'malformed-request' });
    });
  });

  describe('la clé publique VAPID', () => {
    it('est servie quand les clés sont en variables d’environnement', async () => {
      vi.stubEnv('VAPID_PUBLIC_KEY', 'BPublique');
      vi.stubEnv('VAPID_PRIVATE_KEY', 'privée');
      vi.stubEnv('VAPID_SUBJECT', 'mailto:organisateurs@example.org');
      vi.stubEnv('PUBLIC_URL', 'https://chimeres.example.org');
      app = await startApp();

      const response = await server().get(apiUrl(pushSubscriptionEndpoints.readPublicKey)).expect(200);

      expect(response.body).toEqual({ publicKey: 'BPublique' });
    });

    it('n’est pas servie sans clés : 404 push-not-configured', async () => {
      vi.stubEnv('VAPID_PUBLIC_KEY', '');
      vi.stubEnv('VAPID_PRIVATE_KEY', '');
      vi.stubEnv('VAPID_SUBJECT', '');
      app = await startApp();

      const response = await server().get(apiUrl(pushSubscriptionEndpoints.readPublicKey)).expect(404);

      expect(response.body).toMatchObject({ code: 'push-not-configured' });
    });
  });
});
