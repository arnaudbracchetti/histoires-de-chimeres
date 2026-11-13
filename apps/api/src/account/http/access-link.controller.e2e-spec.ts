import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import type { PasswordHasher } from '@chimeres/application';
import {
  accessLinkEndpoints,
  accountEndpoints,
  apiUrl,
  participantEndpoints,
  type AddedParticipantDto,
  type CreatedAccessLinkDto,
  type ParticipantListEntryDto,
  type ParticipantSheetDto,
} from '@chimeres/contract';
import {
  insertAccountSession,
  insertSession,
  TEST_ORGANIZER_NICKNAME,
} from '../../../test/account-session.js';
import { startApp } from '../../../test/app.js';
import { setEnvironment } from '../../../test/environment.js';
import { request, type Response } from '../../../test/http.js';
import { SettableClock } from '../../../test/settable-clock.js';
import { CLOCK } from '../../clock/clock.token.js';
import { PASSWORD_HASHER } from '../password-hasher.token.js';

const PASSWORD = 'une longue phrase';
/** L'heure de l'horloge réglable, et de l'ouverture des sessions insérées. */
const NOW = '2027-03-14T08:30:00Z';

/** Un hachage sans calcul : scrypt prend 400 ms par essai. */
const instantHasher: PasswordHasher = {
  hash: async (password) => `clair:${password.text}`,
  verify: async (text, hash) => hash === `clair:${text}`,
};

/** Le cookie de session posé par la réponse, `nom=valeur`. */
const readSessionCookie = (response: Response) =>
  (response.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

/** Le jeton, dernier segment de l'URL du lien. */
const tokenOf = ({ url }: CreatedAccessLinkDto) => url.split('/').at(-1)!;

describe("Lien d'accès et choix du mot de passe (ID-6, ADR 0018)", () => {
  let app: INestApplication<App>;
  let clock: SettableClock;
  let organizerCookie: string;
  let restoreEnvironment: () => void;
  /** Lune, un MJ : son compte est créé par le rôle, sans mot de passe ni lien. */
  let participantId: string;

  beforeEach(async () => {
    clock = new SettableClock(NOW);
    restoreEnvironment = setEnvironment({ PUBLIC_URL: 'https://chimeres.example.org/' });
    organizerCookie = await insertAccountSession({ openedAt: new Date(NOW) });
    app = await startApp((builder) =>
      builder
        .overrideProvider(CLOCK)
        .useValue(clock)
        .overrideProvider(PASSWORD_HASHER)
        .useValue(instantHasher),
    );
    const { body } = await server()
      .post(apiUrl(participantEndpoints.add))
      .send({ nickname: 'Lune' })
      .expect(201);
    participantId = (body as AddedParticipantDto).participantId;
    await server()
      .put(apiUrl(participantEndpoints.appointGameMaster, { participantId }))
      .expect(200);
  });

  afterEach(async () => {
    await app.close();
    restoreEnvironment();
  });

  const server = (cookie = organizerCookie) => request(app, cookie);
  /** Crée un lien d'accès pour ce pseudo, Lune par défaut. */
  const createLink = async (id = participantId) =>
    (
      await server()
        .post(apiUrl(accessLinkEndpoints.create, { participantId: id }))
        .expect(201)
    ).body as CreatedAccessLinkDto;
  const readLink = (token: string) => request(app).get(apiUrl(accessLinkEndpoints.read, { token }));
  const choosePassword = (token: string, password = PASSWORD) =>
    request(app).post(apiUrl(accessLinkEndpoints.choosePassword, { token })).send({ password });
  const readAccountState = async () =>
    (
      (await server().get(apiUrl(participantEndpoints.read, { participantId })).expect(200))
        .body as ParticipantSheetDto
    ).account;
  const logIn = (password = PASSWORD) =>
    request(app).post(apiUrl(accountEndpoints.logIn)).send({ nickname: 'Lune', password });

  it('un compte sans lien est « Lien à créer »', async () => {
    expect(await readAccountState()).toMatchObject({ state: 'no-link', accessLinkExpiresAt: null });
  });

  it('crée un lien de 256 bits sur le domaine public, valable 7 jours : le compte est en attente', async () => {
    const link = await createLink();

    expect(link.url).toMatch(
      /^https:\/\/chimeres\.example\.org\/gestion\/lien-d-acces\/[\w-]{43}$/,
    );
    // 8 h 30 UTC, 9 h 30 à Paris.
    expect(link.expiresAt).toEqual({ date: '2027-03-21', time: '09:30' });
    expect(await readAccountState()).toMatchObject({
      state: 'pending',
      accessLinkExpiresAt: { date: '2027-03-21', time: '09:30' },
      accessLinkRemainingMinutes: 7 * 24 * 60,
    });
  });

  it('le GET donne le pseudo sans utiliser le lien', async () => {
    const token = tokenOf(await createLink());

    expect((await readLink(token).expect(200)).body).toEqual({ nickname: 'Lune' });
    await readLink(token).expect(200);

    expect((await readAccountState())?.state).toBe('pending');
    await choosePassword(token).expect(200);
  });

  it('le POST choisit le mot de passe et connecte la personne', async () => {
    const token = tokenOf(await createLink());

    const response = await choosePassword(token).expect(200);

    expect(response.body).toMatchObject({ nickname: 'Lune', organizer: false });
    const cookie = readSessionCookie(response);
    expect(cookie).toMatch(/^__Host-account-session=/);
    const account = await request(app, cookie).get(apiUrl(accountEndpoints.read)).expect(200);
    expect(account.body).toMatchObject({ nickname: 'Lune' });
    await logIn().expect(200);
    expect((await readAccountState())?.state).toBe('active');
  });

  it('refuse un mot de passe trop court, et le lien sert encore', async () => {
    const token = tokenOf(await createLink());

    const response = await choosePassword(token, 'court').expect(422);

    expect(response.body).toMatchObject({ code: 'password-too-short' });
    await choosePassword(token).expect(200);
  });

  it('refuse un lien expiré, au GET comme au POST', async () => {
    const token = tokenOf(await createLink());
    // La session de l'Organisateur ne passe pas 7 jours sans activité (ADR 0019).
    clock.advanceDays(6);
    expect((await readAccountState())?.state).toBe('pending');
    clock.advanceDays(1);

    expect((await readLink(token).expect(410)).body).toMatchObject({ code: 'access-link-expired' });
    expect((await choosePassword(token).expect(410)).body).toMatchObject({
      code: 'access-link-expired',
    });
    expect(await readAccountState()).toMatchObject({
      state: 'expired',
      accessLinkExpiresAt: { date: '2027-03-21', time: '09:30' },
    });
  });

  it('refuse un lien déjà utilisé', async () => {
    const token = tokenOf(await createLink());
    await choosePassword(token).expect(200);

    expect((await choosePassword(token, 'une autre phrase').expect(410)).body).toMatchObject({
      code: 'access-link-used',
    });
    expect((await readLink(token).expect(410)).body).toMatchObject({ code: 'access-link-used' });
    await logIn().expect(200);
  });

  it('refuse un jeton inconnu', async () => {
    expect((await readLink('inconnu').expect(404)).body).toMatchObject({
      code: 'access-link-unknown',
    });
  });

  it("un nouveau lien annule l'ancien", async () => {
    const oldToken = tokenOf(await createLink());
    const newToken = tokenOf(await createLink());

    expect((await choosePassword(oldToken).expect(404)).body).toMatchObject({
      code: 'access-link-unknown',
    });
    await choosePassword(newToken).expect(200);
  });

  it('un nouveau lien efface le mot de passe et ferme toutes les sessions', async () => {
    const cookie = readSessionCookie(await choosePassword(tokenOf(await createLink())));
    const otherCookie = readSessionCookie(await logIn().expect(200));

    await createLink();

    await request(app, cookie).get(apiUrl(accountEndpoints.read)).expect(401);
    await request(app, otherCookie).get(apiUrl(accountEndpoints.read)).expect(401);
    expect((await logIn().expect(401)).body).toMatchObject({ code: 'wrong-credentials' });
    expect((await readAccountState())?.state).toBe('pending');
  });

  it('refuse un lien pour un pseudo sans compte', async () => {
    const { body } = await server()
      .post(apiUrl(participantEndpoints.add))
      .send({ nickname: 'Sven' });

    const response = await server()
      .post(
        apiUrl(accessLinkEndpoints.create, {
          participantId: (body as AddedParticipantDto).participantId,
        }),
      )
      .expect(404);

    expect(response.body).toMatchObject({ code: 'account-not-found' });
  });

  it('sans PUBLIC_URL, refuse la création par un message clair, sans toucher au compte', async () => {
    const restore = setEnvironment({ PUBLIC_URL: undefined });
    try {
      const response = await server()
        .post(apiUrl(accessLinkEndpoints.create, { participantId }))
        .expect(503);

      expect(response.body).toMatchObject({ code: 'public-url-missing' });
      expect((await readAccountState())?.state).toBe('no-link');
    } finally {
      restore();
    }
  });

  it('seul un Organisateur crée un lien', async () => {
    const url = apiUrl(accessLinkEndpoints.create, { participantId });
    await request(app).post(url).expect(401);
    const { cookie } = await insertSession({
      nickname: 'Brann',
      organizer: false,
      gameMaster: true,
      openedAt: new Date(NOW),
    });
    await request(app, cookie).post(url).expect(403);
  });

  it('la liste « Participants » donne les rôles et l’état du compte de chaque pseudo (ID-16)', async () => {
    const addParticipant = async (nickname: string) =>
      (
        (await server().post(apiUrl(participantEndpoints.add)).send({ nickname }).expect(201))
          .body as AddedParticipantDto
      ).participantId;
    const astre = await addParticipant('Astre');
    await server().put(apiUrl(participantEndpoints.appointOrganizer, { participantId: astre }));
    await createLink(astre);
    // La session de l'Organisateur ne passe pas 7 jours sans activité (ADR 0019).
    clock.advanceDays(6);
    await server().get(apiUrl(participantEndpoints.list)).expect(200);
    clock.advanceDays(1);
    const brume = await addParticipant('Brume');
    await server().put(apiUrl(participantEndpoints.appointOrganizer, { participantId: brume }));
    await server().put(apiUrl(participantEndpoints.appointGameMaster, { participantId: brume }));
    await createLink(brume);
    await choosePassword(tokenOf(await createLink())).expect(200);
    await addParticipant('Ciel');
    const dune = await addParticipant('Dune');
    await server().put(apiUrl(participantEndpoints.appointGameMaster, { participantId: dune }));

    const { body } = await server().get(apiUrl(participantEndpoints.list)).expect(200);

    expect(
      (body as ParticipantListEntryDto[])
        .filter(({ nickname }) => nickname !== TEST_ORGANIZER_NICKNAME)
        .map(({ nickname, gameMaster, organizer, account }) => ({
          nickname,
          gameMaster,
          organizer,
          account,
        })),
    ).toEqual([
      {
        nickname: 'Astre',
        gameMaster: false,
        organizer: true,
        account: {
          onlyRole: 'organizer',
          state: 'expired',
          accessLinkExpiresAt: { date: '2027-03-21', time: '09:30' },
          accessLinkRemainingMinutes: null,
        },
      },
      {
        nickname: 'Brume',
        gameMaster: true,
        organizer: true,
        account: {
          onlyRole: null,
          state: 'pending',
          accessLinkExpiresAt: { date: '2027-03-28', time: '09:30' },
          accessLinkRemainingMinutes: 7 * 24 * 60,
        },
      },
      { nickname: 'Ciel', gameMaster: false, organizer: false, account: null },
      {
        nickname: 'Dune',
        gameMaster: true,
        organizer: false,
        account: {
          onlyRole: 'game-master',
          state: 'no-link',
          accessLinkExpiresAt: null,
          accessLinkRemainingMinutes: null,
        },
      },
      {
        nickname: 'Lune',
        gameMaster: true,
        organizer: false,
        account: {
          onlyRole: 'game-master',
          state: 'active',
          accessLinkExpiresAt: null,
          accessLinkRemainingMinutes: null,
        },
      },
    ]);
  });
});
