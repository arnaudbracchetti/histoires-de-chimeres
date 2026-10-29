import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  apiUrl,
  conventionEndpoints,
  linkedPhoneEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type LinkPhoneBody,
  type UpdateConventionBody,
} from '@chimeres/contract';
import { startApp } from '../../../test/app.js';

describe('Téléphone relié à un pseudo', () => {
  let app: INestApplication<App>;
  /** Le code de présence, lu dans le DTO de la convention. */
  let code: string;
  /** Un code faux : le vrai, dont le premier caractère est remplacé. */
  let wrong: string;

  beforeEach(async () => {
    app = await startApp();
    code = (
      (await server().get(apiUrl(conventionEndpoints.read)).expect(200)).body as ConventionDto
    ).presenceCode;
    wrong = (code.startsWith('A') ? 'B' : 'A') + code.slice(1);
  });

  afterEach(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  /** S'identifier, avec le cookie `cookie` du téléphone s'il en a un. */
  const link = (body: Partial<LinkPhoneBody> & { nickname: string }, cookie?: string) => {
    const call = server()
      .post(apiUrl(linkedPhoneEndpoints.link))
      .set('X-Forwarded-For', '203.0.113.1')
      .send({ presenceCode: code, confirmation: null, ...body });
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const read = (cookie?: string) => {
    const call = server().get(apiUrl(linkedPhoneEndpoints.read));
    return cookie ? call.set('Cookie', cookie) : call;
  };
  const unlink = (cookie?: string) => {
    const call = server().delete(apiUrl(linkedPhoneEndpoints.unlink));
    return cookie ? call.set('Cookie', cookie) : call;
  };

  /** Le cookie posé par la réponse, tel que le téléphone le renverra : `nom=valeur`. */
  const cookieOf = (response: request.Response) => {
    const header = setCookieOf(response);
    expect(header).toBeDefined();
    return header!.split(';')[0]!;
  };
  const setCookieOf = (response: request.Response): string | undefined =>
    (response.headers['set-cookie'] as unknown as string[] | undefined)?.[0];

  /** Un téléphone relié à un pseudo nouveau : son cookie. */
  const phoneOf = async (nickname: string) => cookieOf(await link({ nickname }).expect(200));

  describe('s’identifier (ID-1)', () => {
    it('crée un pseudo nouveau, le relie au téléphone, et pose le cookie de session', async () => {
      const response = await link({ nickname: '  Élodie ' }).expect(200);

      expect(response.body).toEqual({ status: 'linked', nickname: 'Élodie' });
      const header = setCookieOf(response)!;
      expect(header).toMatch(/; HttpOnly/);
      expect(header).toMatch(/; Secure/);
      expect(header).toMatch(/; SameSite=Lax/);
      expect(header).toMatch(/; Max-Age=2592000/);
      expect(header).toMatch(/; Path=\/api/);
      // Sa valeur est l'identifiant opaque du téléphone, jamais le pseudo.
      expect(header).not.toMatch(/lodie/i);

      expect((await read(cookieOf(response)).expect(200)).body).toEqual({ nickname: 'Élodie' });
    });

    it('demande une confirmation pour un pseudo existant, sans relier le téléphone', async () => {
      await phoneOf('Élodie');

      const response = await link({ nickname: 'Élodie' }).expect(200);

      expect(response.body).toEqual({
        status: 'confirmation-needed',
        confirmation: 'participant',
        nickname: 'Élodie',
      });
      expect(setCookieOf(response)).toBeUndefined();
    });

    it('reconnaît un pseudo existant selon ID-7, et l’affiche tel qu’il a été créé', async () => {
      await phoneOf('Élodie');

      const response = await link({ nickname: ' ELODIE ' }).expect(200);

      expect(response.body).toMatchObject({ status: 'confirmation-needed', nickname: 'Élodie' });
    });

    it('relie un second téléphone au pseudo confirmé, sans couper le premier (ID-8)', async () => {
      const first = await phoneOf('Élodie');

      const response = await link({ nickname: 'elodie', confirmation: 'participant' }).expect(200);

      expect(response.body).toEqual({ status: 'linked', nickname: 'Élodie' });
      const second = cookieOf(response);
      expect(second).not.toBe(first);
      expect((await read(second).expect(200)).body).toEqual({ nickname: 'Élodie' });
      expect((await read(first).expect(200)).body).toEqual({ nickname: 'Élodie' });
    });

    it('coupe d’abord le lien d’un téléphone déjà relié : un pseudo par téléphone (ID-8)', async () => {
      const elodie = await phoneOf('Élodie');

      const response = await link({ nickname: 'Brann' }, elodie).expect(200);

      expect((await read(cookieOf(response)).expect(200)).body).toEqual({ nickname: 'Brann' });
      await read(elodie).expect(401);
    });

    it.each([
      ['vide', '   ', 'nickname-required'],
      ['de plus de 30 caractères', 'a'.repeat(31), 'nickname-too-long'],
    ])('refuse un pseudo %s, rattaché au champ nickname', async (_, nickname, code) => {
      const response = await link({ nickname }).expect(422);

      expect(response.body).toMatchObject({ code, errors: [{ field: 'nickname', code }] });
      expect(setCookieOf(response)).toBeUndefined();
    });

    it('refuse sans le bon code de présence, sans rien créer (ID-2)', async () => {
      const response = await link({ nickname: 'Élodie', presenceCode: wrong }).expect(422);

      expect(response.body).toMatchObject({
        code: 'presence-code-wrong',
        errors: [{ field: 'presenceCode' }],
      });
      expect((await link({ nickname: 'Élodie' }).expect(200)).body).toMatchObject({
        status: 'linked',
      });
    });

    it('compte les codes faux dans la limite d’essais de l’adresse IP (ID-2)', async () => {
      for (let attempt = 0; attempt < 20; attempt++) {
        await link({ nickname: 'Élodie', presenceCode: wrong }).expect(422);
      }

      await link({ nickname: 'Élodie' }).expect(429);
    });

    it.each([
      ['un pseudo qui n’est pas un texte', { nickname: 42 }],
      ['une confirmation inconnue', { nickname: 'Élodie', confirmation: 'game-master' }],
      ['un champ en trop', { nickname: 'Élodie', email: 'elodie@example.org' }],
    ])('refuse %s : 400 malformed-request', async (_, body) => {
      const response = await link(body as LinkPhoneBody).expect(400);

      expect(response.body).toMatchObject({ code: 'malformed-request' });
    });
  });

  describe('session', () => {
    it('refuse un téléphone sans cookie : 401 phone-not-linked', async () => {
      const response = await read()
        .expect(401)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toMatchObject({ status: 401, code: 'phone-not-linked' });
    });

    it('refuse un cookie inconnu : 401 phone-not-linked', async () => {
      const response = await read('linked-phone=inconnu').expect(401);

      expect(response.body).toMatchObject({ code: 'phone-not-linked' });
    });
  });

  describe('changer de pseudo (ID-9)', () => {
    it('coupe le lien de ce téléphone seulement, et efface son cookie', async () => {
      const first = await phoneOf('Élodie');
      const second = cookieOf(
        await link({ nickname: 'Élodie', confirmation: 'participant' }).expect(200),
      );

      const response = await unlink(first).expect(204);

      expect(setCookieOf(response)).toMatch(/^linked-phone=;.*Expires=Thu, 01 Jan 1970/);
      await read(first).expect(401);
      expect((await read(second).expect(200)).body).toEqual({ nickname: 'Élodie' });
    });

    it('garde le pseudo, qui demande une confirmation quand on le retape', async () => {
      await unlink(await phoneOf('Élodie')).expect(204);

      expect((await link({ nickname: 'Élodie' }).expect(200)).body).toMatchObject({
        status: 'confirmation-needed',
      });
    });

    it('ne change rien sur un téléphone déjà coupé', async () => {
      await unlink().expect(204);
    });
  });

  it('refuse tout après la fin de la convention : 410 convention-ended', async () => {
    const elodie = await phoneOf('Élodie');
    const body: UpdateConventionBody = { name: 'Histoires de Chimères', date: '2020-03-14' };
    await server().put(apiUrl(conventionEndpoints.update)).send(body).expect(200);
    await server()
      .post(apiUrl(timeSlotEndpoints.add))
      .send({ start: '09:00', end: '11:30' })
      .expect(201);

    expect((await read(elodie).expect(410)).body).toMatchObject({ code: 'convention-ended' });
    await link({ nickname: 'Brann' }).expect(410);
    await unlink(elodie).expect(410);
  });
});
