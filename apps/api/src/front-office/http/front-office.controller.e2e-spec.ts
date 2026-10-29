import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  conventionEndpoints,
  frontOfficeEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type PresenceCodeBody,
  type UpdateConventionBody,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Front office', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());
  const presenceCode = async () =>
    ((await server().get(apiUrl(conventionEndpoints.read)).expect(200)).body as ConventionDto)
      .presenceCode;
  const read = () => server().get(apiUrl(frontOfficeEndpoints.read));
  /** Depuis l'adresse IP `ip`, que Caddy transmet dans `X-Forwarded-For`. */
  const verify = (body: PresenceCodeBody | object, ip = '203.0.113.1') =>
    server()
      .post(apiUrl(frontOfficeEndpoints.verifyPresenceCode))
      .set('X-Forwarded-For', ip)
      .send(body);
  /** Un code faux : le vrai, dont le premier caractère est remplacé. */
  const wrongCode = async () => {
    const code = await presenceCode();
    return (code.startsWith('A') ? 'B' : 'A') + code.slice(1);
  };
  /** Fixe la date de la convention et ajoute un créneau de 9 h 00 à 11 h 30. */
  const holdConventionOn = async (date: string | null) => {
    const body: UpdateConventionBody = { name: 'Histoires de Chimères', date };
    await server().put(apiUrl(conventionEndpoints.update)).send(body).expect(200);
    await server()
      .post(apiUrl(timeSlotEndpoints.add))
      .send({ start: '09:00', end: '11:30' })
      .expect(201);
  };

  it('donne le nom de la convention au front office', async () => {
    const response = await read().expect(200);

    expect(response.body).toEqual({ conventionName: 'Histoires de Chimères' });
  });

  it('accepte le code de présence, en minuscules et avec des espaces autour : 204 (ID-2)', async () => {
    const code = await presenceCode();

    await verify({ presenceCode: ` ${code.toLowerCase()} ` }).expect(204);
  });

  it('refuse un code faux : 422, rattaché au champ presenceCode (ID-2)', async () => {
    const response = await verify({ presenceCode: await wrongCode() })
      .expect(422)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      status: 422,
      code: 'presence-code-wrong',
      errors: [
        {
          field: 'presenceCode',
          code: 'presence-code-wrong',
          message: "Ce code ne correspond pas. Vérifie-le sur l'affiche, sous le QR code.",
        },
      ],
    });
  });

  it.each([
    ['un code qui n’est pas un texte', { presenceCode: 42 }],
    ['un champ manquant', {}],
    ['un champ en trop', { presenceCode: 'K7M2', nickname: 'Élodie' }],
  ])('refuse %s : 400 malformed-request', async (_, body) => {
    const response = await verify(body).expect(400);

    expect(response.body).toMatchObject({ code: 'malformed-request' });
  });

  it('refuse tout essai après 20 codes faux depuis la même adresse IP, même le bon (ID-2)', async () => {
    const code = await presenceCode();
    const wrong = await wrongCode();
    for (let attempt = 0; attempt < 20; attempt++) {
      await verify({ presenceCode: wrong }).expect(422);
    }

    const response = await verify({ presenceCode: code })
      .expect(429)
      .expect('Content-Type', /application\/problem\+json/);

    expect(response.body).toMatchObject({
      status: 429,
      code: 'too-many-attempts',
      title: "Trop d'essais",
      errors: [{ field: 'presenceCode', code: 'too-many-attempts' }],
    });
    // Une autre adresse IP n'est pas concernée.
    await verify({ presenceCode: code }, '203.0.113.2').expect(204);
  });

  it('ne compte pas les bons codes parmi les échecs', async () => {
    const code = await presenceCode();
    for (let attempt = 0; attempt < 25; attempt++) {
      await verify({ presenceCode: code }).expect(204);
    }

    await verify({ presenceCode: await wrongCode() }).expect(422);
  });

  describe('fin de la convention, à la fin de son dernier créneau', () => {
    it('ferme le front office, avec ou sans code : 410 convention-ended', async () => {
      const code = await presenceCode();
      await holdConventionOn('2020-03-14');

      const withoutCode = await read()
        .expect(410)
        .expect('Content-Type', /application\/problem\+json/)
        // Sans cet en-tête, Chrome garde un 410 sans limite : la convention rouverte resterait fermée.
        .expect('Cache-Control', 'no-store');
      const withCode = await verify({ presenceCode: code }).expect(410);

      expect(withoutCode.body).toMatchObject({
        status: 410,
        code: 'convention-ended',
        title: 'La convention est terminée',
      });
      expect(withCode.body).toMatchObject({ code: 'convention-ended' });
    });

    it('laisse ouvert une convention à venir', async () => {
      await holdConventionOn('2099-03-14');

      await read().expect(200);
    });

    it('laisse ouvert une convention sans date, même avec des créneaux', async () => {
      await holdConventionOn(null);

      await read().expect(200);
    });

    it('laisse ouvert une convention passée sans créneau', async () => {
      const body: UpdateConventionBody = { name: 'Histoires de Chimères', date: '2020-03-14' };
      await server().put(apiUrl(conventionEndpoints.update)).send(body).expect(200);

      await read().expect(200);
    });
  });
});
