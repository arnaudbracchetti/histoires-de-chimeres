import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PasswordHasher } from '@chimeres/application';
import { accountEndpoints, apiUrl, type LogInBody } from '@chimeres/contract';
import { insertAccountSession } from '../../../test/account-session.js';
import { startApp } from '../../../test/app.js';
import { setEnvironment } from '../../../test/environment.js';
import { request, type Response } from '../../../test/http.js';
import { SettableClock } from '../../../test/settable-clock.js';
import { CLOCK } from '../../clock/clock.token.js';
import { PASSWORD_HASHER } from '../password-hasher.token.js';

const PASSWORD = 'une longue phrase';

/** Un hachage sans calcul, pour les tests qui enchaînent les essais : scrypt y prend 400 ms. */
const instantHasher: PasswordHasher = {
  hash: async (password) => `clair:${password.text}`,
  verify: async (text, hash) => hash === `clair:${text}`,
};

/** Le cookie de session posé par la réponse, `nom=valeur`. */
const readSessionCookie = (response: Response) =>
  (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

describe('Compte du back office : connexion et session (ADR 0015, 0018, 0019)', () => {
  let app: INestApplication<App>;
  let clock: SettableClock;
  let restoreEnvironment: () => void;

  /** Démarre l'application avec Kaïros comme premier Organisateur, et l'horloge réglable. */
  const start = async (hasher?: PasswordHasher) => {
    app = await startApp((builder) => {
      const withClock = builder.overrideProvider(CLOCK).useValue(clock);
      return hasher ? withClock.overrideProvider(PASSWORD_HASHER).useValue(hasher) : withClock;
    });
  };

  beforeEach(() => {
    clock = new SettableClock('2027-03-14T08:00:00Z');
    restoreEnvironment = setEnvironment({
      ORGANIZER_PSEUDO: 'Kaïros',
      ORGANIZER_PASSWORD: PASSWORD,
    });
  });

  afterEach(async () => {
    await app.close();
    restoreEnvironment();
  });

  const logIn = (body: LogInBody) => request(app).post(apiUrl(accountEndpoints.logIn)).send(body);
  const readAccount = (cookie: string) =>
    request(app).get(apiUrl(accountEndpoints.read)).set('Cookie', cookie);

  describe('avec scrypt', () => {
    beforeEach(() => start());

    it('connecte par pseudo et mot de passe, et pose le cookie de session avec ses attributs', async () => {
      const response = await logIn({ nickname: 'Kaïros', password: PASSWORD }).expect(200);

      expect(response.body).toEqual({ nickname: 'Kaïros', organizer: true, gameMasterId: null });
      const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!;
      expect(cookie).toMatch(/^__Host-account-session=[\w-]{43};/);
      expect(cookie).toContain('Path=/;');
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      const account = await readAccount(readSessionCookie(response)).expect(200);
      expect(account.body).toEqual({ nickname: 'Kaïros', organizer: true, gameMasterId: null });
    });

    it('reconnaît le pseudo malgré la casse, les accents et les espaces (ID-7)', async () => {
      await logIn({ nickname: '  KAIROS ', password: PASSWORD }).expect(200);
    });

    it('donne la même réponse pour un mauvais mot de passe et pour un pseudo inconnu', async () => {
      const wrongPassword = await logIn({ nickname: 'Kaïros', password: 'pas le bon mot' });
      const unknown = await logIn({ nickname: 'Personne', password: PASSWORD });

      expect(wrongPassword.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknown.body);
      expect(wrongPassword.body.code).toBe('wrong-credentials');
      expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    });

    it('ouvre une session neuve à chaque connexion', async () => {
      const first = readSessionCookie(await logIn({ nickname: 'Kaïros', password: PASSWORD }));
      const second = readSessionCookie(await logIn({ nickname: 'Kaïros', password: PASSWORD }));

      expect(second).not.toBe(first);
      await readAccount(first).expect(200);
      await readAccount(second).expect(200);
    });

    it('se déconnecter supprime la session : son cookie ne sert plus', async () => {
      const cookie = readSessionCookie(await logIn({ nickname: 'Kaïros', password: PASSWORD }));

      const response = await request(app)
        .delete(apiUrl(accountEndpoints.logOut))
        .set('Cookie', cookie)
        .expect(204);

      expect((response.headers['set-cookie'] as unknown as string[])[0]).toMatch(
        /^__Host-account-session=;/,
      );
      const refused = await readAccount(cookie).expect(401);
      expect(refused.body.code).toBe('not-logged-in');
    });

    it('refuse de lire le compte sans session, ou avec un cookie inconnu', async () => {
      await request(app).get(apiUrl(accountEndpoints.read)).expect(401);
      await readAccount('__Host-account-session=inconnu').expect(401);
    });

    it('ferme la session après 7 jours sans activité', async () => {
      const cookie = readSessionCookie(await logIn({ nickname: 'Kaïros', password: PASSWORD }));

      clock.advanceDays(7);

      await readAccount(cookie).expect(401);
    });

    it('prolonge la session à chaque lecture, mais la ferme 30 jours après la connexion', async () => {
      const cookie = readSessionCookie(await logIn({ nickname: 'Kaïros', password: PASSWORD }));

      for (let day = 6; day < 30; day += 6) {
        clock.advanceDays(6);
        await readAccount(cookie).expect(200);
      }
      clock.advanceDays(6);

      await readAccount(cookie).expect(401);
    });

    it('lit le compte de la session insérée par les tests (ADR 0020)', async () => {
      const cookie = await insertAccountSession({
        nickname: 'Lune',
        organizer: false,
        openedAt: new Date('2027-03-14T08:00:00Z'),
      });

      const response = await readAccount(cookie).expect(200);

      expect(response.body).toEqual({ nickname: 'Lune', organizer: false, gameMasterId: null });
    });
  });

  describe('limite des essais, sans blocage du compte (ADR 0018)', () => {
    beforeEach(() => start(instantHasher));

    it('refuse en 429 le 6e essai de la minute pour un même pseudo, puis accepte la minute suivante', async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        await logIn({ nickname: 'Kaïros', password: 'pas le bon mot' }).expect(401);
      }

      const refused = await logIn({ nickname: 'kairos', password: PASSWORD }).expect(429);
      expect(refused.body.code).toBe('too-many-login-attempts');
      await logIn({ nickname: 'Personne', password: PASSWORD }).expect(401);

      clock.advanceMinutes(1);
      await logIn({ nickname: 'Kaïros', password: PASSWORD }).expect(200);
    });

    it('refuse en 429 le 31e essai de la minute depuis une même adresse IP', async () => {
      for (let attempt = 0; attempt < 30; attempt++) {
        await logIn({ nickname: `Pseudo ${attempt}`, password: PASSWORD }).expect(401);
      }

      await logIn({ nickname: 'Kaïros', password: PASSWORD }).expect(429);

      clock.advanceMinutes(1);
      await logIn({ nickname: 'Kaïros', password: PASSWORD }).expect(200);
    });
  });
});
