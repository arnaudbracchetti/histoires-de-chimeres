import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  apiUrl,
  frontOfficeEndpoints,
  signUpEndpoints,
  type FrontOfficeGameDto,
  type FrontOfficeScheduleDto,
  type FrontOfficeTimeSlotDto,
  type ParticipantSituationDto,
} from '@chimeres/contract';
import { LinkedPhone } from '../linked-phone';
import { Alerts } from '../shell/alerts';
import { PageVisibility } from './page-visibility';
import { ParticipantData } from './participant-data';
import { PhoneClock } from './phone-clock';

const game = (id: string, timeSlotIds: string[]): FrontOfficeGameDto => ({
  id,
  timeSlotIds,
  tableName: 'Griffon',
  title: id,
  system: 'Dune',
  gameMasterNickname: 'Brann',
  imageUrl: null,
  presentation: '',
  contentWarnings: '',
  seats: { min: 3, max: 5 },
  signUpCount: 0,
  playerCount: null,
  oversubscribed: false,
});

/** Le 14 mars 2027 : créneaux 1 (9 h – 11 h 30) et 2 (14 h – 18 h 30). « Épice » est double. */
const schedule = (games: FrontOfficeGameDto[]): FrontOfficeScheduleDto => ({
  date: '2027-03-14',
  timeSlots: [
    { id: 's1', rank: 1, start: '09:00', end: '11:30' },
    { id: 's2', rank: 2, start: '14:00', end: '18:30' },
  ],
  games,
  end: { date: '2027-03-14', time: '18:30' },
});
const brumes = game('Brumes', ['s1']);
const epice = game('Épice', ['s1', 's2']);
const neons = game('Néons', ['s2']);

type TimeSlotSituation = ParticipantSituationDto['timeSlots'][number];
/** Un créneau de la situation, où le pseudo ne mène rien sauf `ledGameId`. */
type GivenTimeSlot = Omit<TimeSlotSituation, 'ledGameId'> & { ledGameId?: string | null };
const open = (timeSlotId: string): GivenTimeSlot => ({
  timeSlotId,
  state: 'sign-ups-open',
  drawResult: null,
});
/** Inscrit à `signedUpGameIds`, les deux créneaux aux inscriptions ouvertes, sauf ceux donnés. */
const situation = (
  signedUpGameIds: string[] = [],
  ...timeSlots: GivenTimeSlot[]
): ParticipantSituationDto => ({
  signedUpGameIds,
  timeSlots: ['s1', 's2'].map((id) => ({
    ledGameId: null,
    ...(timeSlots.find(({ timeSlotId }) => timeSlotId === id) ?? open(id)),
  })),
});

describe('ParticipantData', () => {
  let now: Date;
  const visible = signal(true);
  const unlinkedByServer = vi.fn();

  const configure = () =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLocationMocks(),
        provideRouter([{ path: '**', children: [] }]),
        ParticipantData,
        { provide: PhoneClock, useValue: { now: () => now } },
        { provide: PageVisibility, useValue: { visible } },
        { provide: LinkedPhone, useValue: { unlinkedByServer } },
      ],
    });

  beforeEach(() => {
    vi.useFakeTimers();
    now = new Date(2027, 2, 14, 8, 0);
    visible.set(true);
    unlinkedByServer.mockClear();
    configure();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  const http = () => TestBed.inject(HttpTestingController);
  const reads = () => http().match(apiUrl(frontOfficeEndpoints.readSchedule));

  /**
   * Répond aux lectures en attente, programme et situation, et laisse le module les ranger. Une
   * réponse servie porte l'en-tête `Date` de sa lecture par le serveur, que le cache du service
   * worker garde : l'heure du téléphone par défaut.
   */
  async function answer(
    dto: FrontOfficeScheduleDto | 'failure',
    readAt: Date = now,
    situationDto: ParticipantSituationDto = situation(),
  ): Promise<void> {
    const request = http().expectOne(apiUrl(frontOfficeEndpoints.readSchedule));
    const situationRequest = http().expectOne(apiUrl(frontOfficeEndpoints.readSituation));
    if (dto === 'failure') {
      request.flush(null, { status: 502, statusText: 'Bad Gateway' });
      situationRequest.flush(null, { status: 502, statusText: 'Bad Gateway' });
    } else {
      request.flush(dto, { headers: { Date: readAt.toUTCString() } });
      situationRequest.flush(situationDto);
    }
    await vi.advanceTimersByTimeAsync(0);
  }

  /** Les deux lectures refusées par l'API, avec ce Problem Details. */
  async function refuse(problem: { code: string; title: string; status: number }) {
    for (const read of [frontOfficeEndpoints.readSchedule, frontOfficeEndpoints.readSituation]) {
      http().expectOne(apiUrl(read)).flush(problem, { status: problem.status, statusText: '' });
    }
    await vi.advanceTimersByTimeAsync(0);
  }

  /** Le module, ouvert, avec sa première lecture servie. */
  async function opened(
    dto = schedule([brumes, epice, neons]),
    readAt?: Date,
    situationDto?: ParticipantSituationDto,
  ): Promise<ParticipantData> {
    const data = TestBed.inject(ParticipantData);
    await answer(dto, readAt, situationDto);
    // La relecture toutes les 30 s attend que l'application soit stable.
    await TestBed.inject(ApplicationRef).whenStable();
    return data;
  }

  it('lit le programme à l’ouverture', async () => {
    const data = await opened();

    expect(data.schedule()?.games.map(({ id }) => id)).toEqual(['Brumes', 'Épice', 'Néons']);
    expect(data.schedule()?.timeSlots.map(({ rank }) => rank)).toEqual([1, 2]);
  });

  it('relit toutes les 30 s tant que la page est visible', async () => {
    const data = await opened();

    await vi.advanceTimersByTimeAsync(29_000);
    expect(reads()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1_000);
    await answer(schedule([epice]));

    expect(data.schedule()?.games.map(({ id }) => id)).toEqual(['Épice']);
  });

  it('ne relit pas tant que la page est cachée, puis relit au retour au premier plan', async () => {
    const data = await opened();

    visible.set(false);
    await vi.advanceTimersByTimeAsync(90_000);
    expect(reads()).toHaveLength(0);

    visible.set(true);
    await vi.advanceTimersByTimeAsync(0);
    await answer(schedule([brumes]));
    expect(data.schedule()?.games.map(({ id }) => id)).toEqual(['Brumes']);
  });

  it('relit à l’ouverture de chaque écran', async () => {
    const data = await opened();

    await TestBed.inject(Router).navigateByUrl('/programme');
    await answer(schedule([]));

    expect(data.schedule()?.games).toEqual([]);
  });

  it('garde la dernière valeur quand une lecture échoue', async () => {
    const data = await opened();

    await vi.advanceTimersByTimeAsync(30_000);
    await answer('failure');

    expect(data.schedule()?.games.map(({ id }) => id)).toEqual(['Brumes', 'Épice', 'Néons']);
  });

  it('n’a pas de programme tant que la première lecture n’a pas abouti', async () => {
    const data = TestBed.inject(ParticipantData);

    await answer('failure');

    expect(data.schedule()).toBeUndefined();
  });

  it('cache les créneaux terminés selon l’heure du téléphone, même sans réseau (story 53)', async () => {
    const data = await opened();

    now = new Date(2027, 2, 14, 11, 30);
    await vi.advanceTimersByTimeAsync(30_000);
    await answer('failure');

    expect(data.schedule()?.timeSlots.map(({ rank }) => rank)).toEqual([2]);
    expect(data.schedule()?.games.map(({ id }) => id)).toEqual(['Néons']);
  });

  it('cache une partie double dès la fin de son premier créneau : elle a commencé', async () => {
    const data = await opened();

    now = new Date(2027, 2, 14, 14, 0);
    await vi.advanceTimersByTimeAsync(30_000);
    await answer('failure');

    expect(data.schedule()?.timeSlots.map(({ rank }) => rank)).toEqual([2]);
    expect(data.schedule()?.games.map(({ id }) => id)).not.toContain('Épice');
  });

  it('ne termine aucun créneau d’une convention sans date', async () => {
    now = new Date(2099, 0, 1);
    const data = await opened({ ...schedule([brumes]), date: null, end: null });

    expect(data.schedule()?.timeSlots.map(({ rank }) => rank)).toEqual([1, 2]);
  });

  describe('ligne d’âge', () => {
    it('ne dit rien tant que la donnée a moins de 2 minutes', async () => {
      const data = await opened();

      now = new Date(2027, 2, 14, 8, 2);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');

      expect(data.ageLine()).toBeNull();
    });

    it('dit l’heure de la dernière lecture au-delà de 2 minutes sans réseau', async () => {
      const data = await opened();

      now = new Date(2027, 2, 14, 8, 2, 1);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');

      expect(data.ageLine()).toBe('Pas de connexion · à jour à 8\u00a0h\u00a000');
    });

    it('prend l’âge de l’en-tête `Date` : une copie du service worker est ancienne', async () => {
      const data = await opened(schedule([brumes]), new Date(2027, 2, 13, 18, 5));

      expect(data.ageLine()).toBe('Pas de connexion · à jour le 13 mars à 18\u00a0h\u00a005');
    });

    it('disparaît à la lecture suivante qui aboutit', async () => {
      const data = await opened(schedule([brumes]), new Date(2027, 2, 13, 18, 5));

      void data.reread();
      await answer(schedule([brumes]));

      expect(data.ageLine()).toBeNull();
    });
  });

  describe('fin de la convention', () => {
    it('arrive à la fin du dernier créneau selon l’heure du téléphone, même sans réseau', async () => {
      const data = await opened();

      now = new Date(2027, 2, 14, 18, 29);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');
      expect(data.ended()).toBe(false);

      now = new Date(2027, 2, 14, 18, 30);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');
      expect(data.ended()).toBe(true);
    });

    it('n’arrive jamais sans date ni créneau', async () => {
      now = new Date(2099, 0, 1);
      const data = await opened({ ...schedule([]), date: null, end: null });

      expect(data.ended()).toBe(false);
    });

    it('arrive quand le serveur refuse la lecture : la convention est terminée', async () => {
      const data = await opened();

      await vi.advanceTimersByTimeAsync(30_000);
      await refuse({ code: 'convention-ended', title: 'La convention est terminée.', status: 410 });

      expect(data.ended()).toBe(true);
    });
  });

  it('signale un lien coupé, pour revenir à l’identification et oublier la copie (ID-8)', async () => {
    await opened();

    await vi.advanceTimersByTimeAsync(30_000);
    await refuse({
      code: 'phone-not-linked',
      title: 'Ce téléphone n’est relié à aucun pseudo.',
      status: 401,
    });

    expect(unlinkedByServer).toHaveBeenCalled();
  });

  describe('s’inscrire et se désinscrire (IN-2)', () => {
    const signUpUrl = (gameId: string) => apiUrl(signUpEndpoints.signUp, { gameId });
    const alerts = () =>
      TestBed.inject(Alerts)
        .notices()
        .map(({ title }) => title);

    it('inscrit, attend pendant l’envoi, puis relit : la barre dit « Inscription enregistrée »', async () => {
      const data = await opened();

      const gesture = data.signUp('Brumes');
      expect(data.signUpBarOf('Brumes')).toEqual({
        kind: 'open',
        signedUp: false,
        pending: true,
        oversubscribedAfterSignUp: false,
      });
      const request = http().expectOne(signUpUrl('Brumes'));
      expect(request.request.method).toBe('PUT');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await vi.advanceTimersByTimeAsync(0);
      await answer(schedule([{ ...brumes, signUpCount: 1 }, epice]), now, situation(['Brumes']));
      await gesture;

      expect(data.signUpBarOf('Brumes')).toEqual({
        kind: 'open',
        signedUp: true,
        pending: false,
        oversubscribedAfterSignUp: false,
      });
      expect(data.isSignedUp('Brumes')).toBe(true);
      expect(data.schedule()?.games[0]?.signUpCount).toBe(1);
      expect(alerts()).toEqual([]);
    });

    it('ignore un second tap pendant l’envoi', async () => {
      const data = await opened();

      void data.signUp('Brumes');
      void data.signUp('Brumes');

      http().expectOne(signUpUrl('Brumes')).flush(null, { status: 204, statusText: '' });
      await vi.advanceTimersByTimeAsync(0);
      await answer(schedule([brumes]), now, situation(['Brumes']));
    });

    it('désinscrit d’un tap, sans confirmation', async () => {
      const data = await opened(schedule([brumes]), now, situation(['Brumes']));

      const gesture = data.withdraw('Brumes');
      const request = http().expectOne(apiUrl(signUpEndpoints.withdraw, { gameId: 'Brumes' }));
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: '' });
      await vi.advanceTimersByTimeAsync(0);
      await answer(schedule([brumes]), now, situation());
      await gesture;

      expect(data.isSignedUp('Brumes')).toBe(false);
    });

    it('sans réseau, dit que rien n’a été enregistré, puis relit', async () => {
      const data = await opened();

      const gesture = data.signUp('Brumes');
      http().expectOne(signUpUrl('Brumes')).error(new ProgressEvent('error'), { status: 0 });
      await vi.advanceTimersByTimeAsync(0);
      await answer('failure');
      await gesture;

      expect(alerts()).toEqual(["Pas de connexion\u00a0: rien n'a été enregistré."]);
      expect(data.signUpBarOf('Brumes')).toEqual({
        kind: 'open',
        signedUp: false,
        pending: false,
        oversubscribedAfterSignUp: false,
      });
    });

    it('après 10 s sans réponse, dit de vérifier l’inscription, puis relit', async () => {
      const data = await opened();

      const gesture = data.signUp('Brumes');
      const request = http().expectOne(signUpUrl('Brumes'));
      await vi.advanceTimersByTimeAsync(9_999);
      expect(alerts()).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(alerts()).toEqual(['Le réseau ne répond pas\u00a0: vérifie ton inscription.']);
      // La demande était passée : la relecture le montre.
      await answer(schedule([brumes]), now, situation(['Brumes']));
      await gesture;

      expect(data.signUpBarOf('Brumes')).toEqual({
        kind: 'open',
        signedUp: true,
        pending: false,
        oversubscribedAfterSignUp: false,
      });
      expect(request.cancelled).toBe(false);
      request.flush(null, { status: 204, statusText: '' });
      await vi.advanceTimersByTimeAsync(0);
      // La réponse tardive est relue, sans nouvelle alerte.
      await answer(schedule([brumes]), now, situation(['Brumes']));
      expect(alerts()).toHaveLength(1);
    });

    it('montre le message de l’API sur un refus, puis relit', async () => {
      const data = await opened();

      const gesture = data.signUp('Brumes');
      http().expectOne(signUpUrl('Brumes')).flush(
        {
          code: 'sign-ups-closed',
          title: 'Inscriptions fermées',
          detail: 'Le tirage du créneau 1 est lancé : ses inscriptions sont fermées.',
          status: 422,
        },
        { status: 422, statusText: '' },
      );
      await vi.advanceTimersByTimeAsync(0);
      await answer(schedule([brumes]), now, situation([], { ...open('s1'), state: 'drawing' }));
      await gesture;

      expect(alerts()).toEqual(['Inscriptions fermées']);
      expect(data.signUpBarOf('Brumes')).toEqual({ kind: 'drawing', rank: 1, signedUp: false });
    });
  });

  describe('barre d’inscription de la fiche', () => {
    it('n’existe pas pour une partie hors du programme', async () => {
      const data = await opened();

      expect(data.signUpBarOf('inconnue')).toBeNull();
    });

    describe('confirmation « Partie très demandée » avant l’inscription (IN-5)', () => {
      const withSignUps = (dto: FrontOfficeGameDto, signUpCount: number) => ({
        ...dto,
        signUpCount,
        oversubscribed: signUpCount > dto.seats.max,
      });
      const confirmationBefore = async (signUpCount: number, signedUpGameIds: string[] = []) => {
        const data = await opened(
          schedule([withSignUps(brumes, signUpCount)]),
          now,
          situation(signedUpGameIds),
        );
        const bar = data.signUpBarOf('Brumes');
        return bar?.kind === 'open' && bar.oversubscribedAfterSignUp;
      };

      it('vient quand l’inscription ferait passer la partie au-dessus de ses places maximum', async () => {
        expect(await confirmationBefore(5)).toBe(true);
      });

      it('vient quand la partie est déjà très demandée', async () => {
        expect(await confirmationBefore(7)).toBe(true);
      });

      it('ne vient pas tant que l’inscription tient dans les places maximum', async () => {
        expect(await confirmationBefore(4)).toBe(false);
      });

      it('ne vient pas pour un inscrit, qui ne peut que se désinscrire', async () => {
        expect(await confirmationBefore(7, ['Brumes'])).toBe(false);
      });
    });

    it('dit « Tirage en cours » quand le tirage du premier créneau est lancé', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Épice'], { ...open('s1'), state: 'drawing' }),
      );

      expect(data.signUpBarOf('Épice')).toEqual({ kind: 'drawing', rank: 1, signedUp: true });
      expect(data.signUpBarOf('Néons')).toEqual({
        kind: 'open',
        signedUp: false,
        pending: false,
        oversubscribedAfterSignUp: false,
      });
    });

    it('dit « Tu joues aux créneaux 1 et 2 » sur le créneau qu’occupe la partie double publiée', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Néons'], {
          timeSlotId: 's1',
          state: 'published',
          drawResult: { kind: 'assigned', gameId: 'Épice' },
        }),
      );

      expect(data.signUpBarOf('Néons')).toEqual({ kind: 'held', game: epice, signedUp: true });
    });

    it('dit le résultat publié du tirage du créneau', async () => {
      const published = (drawResult: TimeSlotSituation['drawResult']) =>
        opened(
          schedule([brumes, neons, game('Ruines', ['s1'])]),
          undefined,
          situation([], { timeSlotId: 's1', state: 'published', drawResult }),
        );

      let data = await published({ kind: 'assigned', gameId: 'Brumes' });
      expect(data.signUpBarOf('Brumes')).toEqual({ kind: 'assigned-here' });
      expect(data.signUpBarOf('Ruines')).toEqual({ kind: 'assigned-elsewhere', game: brumes });
      expect(data.signUpBarOf('Néons')).toEqual({
        kind: 'open',
        signedUp: false,
        pending: false,
        oversubscribedAfterSignUp: false,
      });

      TestBed.resetTestingModule();
      configure();
      data = await published({ kind: 'unassigned' });
      expect(data.signUpBarOf('Brumes')).toEqual({ kind: 'unassigned' });

      TestBed.resetTestingModule();
      configure();
      data = await published(null);
      expect(data.signUpBarOf('Brumes')).toEqual({ kind: 'closed', rank: 1 });
    });
  });

  describe('Mes parties', () => {
    /** Pour chaque créneau de Mes parties : son rang et ses inscriptions. */
    const signUpsBySlot = (data: ParticipantData) =>
      data
        .myTimeSlots()
        ?.map(({ timeSlot, signedUpGames }) => [timeSlot.rank, signedUpGames.map(({ id }) => id)]);

    it('montre les inscriptions par créneau à venir, une partie double sous son premier créneau (IN-3, story 53)', async () => {
      const data = await opened(undefined, undefined, situation(['Épice', 'Néons']));

      expect(signUpsBySlot(data)).toEqual([
        [1, ['Épice']],
        [2, ['Néons']],
      ]);

      now = new Date(2027, 2, 14, 11, 30);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');
      expect(signUpsBySlot(data)).toEqual([[2, ['Néons']]]);
    });

    it('montre l’affectation, ou « Pas de place pour toi », après la publication du créneau (TI-7, story 86)', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(
          ['Brumes', 'Néons'],
          {
            timeSlotId: 's1',
            state: 'published',
            drawResult: { kind: 'assigned', gameId: 'Brumes' },
          },
          { timeSlotId: 's2', state: 'published', drawResult: { kind: 'unassigned' } },
        ),
      );

      expect(data.myTimeSlots()?.map(({ assignment }) => assignment)).toEqual([
        { kind: 'assigned', game: brumes },
        { kind: 'unassigned', gamesWithSeats: [] },
      ]);
    });

    it('ne montre aucune affectation avant la publication (TI-5, story 86)', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Brumes'], { ...open('s1'), state: 'drawing' }),
      );

      expect(data.myTimeSlots()?.map(({ assignment }) => assignment)).toEqual([null, null]);
    });

    it('montre la partie double publiée sur son second créneau aussi (TI-3)', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Épice', 'Néons'], {
          timeSlotId: 's1',
          state: 'published',
          drawResult: { kind: 'assigned', gameId: 'Épice' },
        }),
      );

      expect(data.myTimeSlots()?.map(({ assignment }) => assignment)).toEqual([
        { kind: 'assigned', game: epice },
        { kind: 'assigned', game: epice },
      ]);

      now = new Date(2027, 2, 14, 14, 0);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');
      expect(data.myTimeSlots()?.map(({ assignment }) => assignment)).toEqual([
        { kind: 'assigned', game: epice },
      ]);
    });

    describe('rappel « partie très demandée » (IN-5)', () => {
      const oversubscribed = (dto: FrontOfficeGameDto) => ({ ...dto, oversubscribed: true });
      /** Les rangs des créneaux qui portent le rappel. */
      const reminded = (data: ParticipantData) =>
        data
          .myTimeSlots()
          ?.filter(({ onlySignUpOversubscribed }) => onlySignUpOversubscribed)
          .map(({ timeSlot }) => timeSlot.rank);

      it('apparaît quand la seule inscription du créneau est une partie très demandée', async () => {
        const data = await opened(
          schedule([oversubscribed(brumes), epice, neons]),
          undefined,
          situation(['Brumes']),
        );

        expect(reminded(data)).toEqual([1]);
      });

      it('n’apparaît pas avec une autre inscription sur le créneau, ni pour une partie qui ne l’est pas', async () => {
        const data = await opened(
          schedule([oversubscribed(brumes), game('Ruines', ['s1']), epice, neons]),
          undefined,
          situation(['Brumes', 'Ruines', 'Néons']),
        );

        expect(reminded(data)).toEqual([]);
      });

      it('disparaît dès le lancement du tirage : les inscriptions sont fermées', async () => {
        const data = await opened(
          schedule([oversubscribed(brumes), epice, neons]),
          undefined,
          situation(['Brumes'], { ...open('s1'), state: 'drawing' }),
        );

        expect(reminded(data)).toEqual([]);
      });

      it('compte une partie double sur son seul premier créneau', async () => {
        let data = await opened(
          schedule([brumes, oversubscribed(epice), neons]),
          undefined,
          situation(['Épice', 'Néons']),
        );
        expect(reminded(data)).toEqual([1]);

        TestBed.resetTestingModule();
        configure();
        data = await opened(
          schedule([brumes, epice, oversubscribed(neons)]),
          undefined,
          situation(['Épice', 'Néons']),
        );
        expect(reminded(data)).toEqual([2]);
      });

      it('n’apparaît pas sur le second créneau d’une partie double où le pseudo joue (TI-3)', async () => {
        const data = await opened(
          schedule([brumes, epice, oversubscribed(neons)]),
          undefined,
          situation(['Épice', 'Néons'], {
            timeSlotId: 's1',
            state: 'published',
            drawResult: { kind: 'assigned', gameId: 'Épice' },
          }),
        );

        expect(reminded(data)).toEqual([]);
      });
    });
  });

  describe('Accueil', () => {
    /** Les rangs des créneaux de « Ton programme ». */
    const programmeRanks = (data: ParticipantData) =>
      data.home()?.timeSlots.map(({ timeSlot }) => timeSlot.rank);

    it('montre « Choisis tes parties » sans affectation à montrer, et chaque créneau à venir dans « Ton programme » (stories 59, 60)', async () => {
      const data = await opened(undefined, undefined, situation(['Brumes']));

      expect(data.home()?.card).toEqual({ kind: 'choose-games' });
      expect(programmeRanks(data)).toEqual([1, 2]);
    });

    const published = (timeSlotId: string, drawResult: TimeSlotSituation['drawResult']) => ({
      timeSlotId,
      state: 'published' as const,
      drawResult,
    });
    const [slot1, slot2] = schedule([]).timeSlots as [
      FrontOfficeTimeSlotDto,
      FrontOfficeTimeSlotDto,
    ];

    it('montre l’affectation publiée tant que son créneau n’est pas terminé, puis « Maintenant » dès son début (story 54)', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Brumes'], published('s1', { kind: 'assigned', gameId: 'Brumes' })),
      );

      expect(data.home()?.card).toEqual({
        kind: 'assigned',
        game: brumes,
        timeSlots: [slot1],
        started: false,
      });
      expect(programmeRanks(data)).toEqual([2]);

      now = new Date(2027, 2, 14, 9, 0);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');
      expect(data.home()?.card).toMatchObject({ kind: 'assigned', started: true });

      now = new Date(2027, 2, 14, 11, 30);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');
      expect(data.home()?.card).toEqual({ kind: 'choose-games' });
      expect(programmeRanks(data)).toEqual([2]);
    });

    it('montre la dernière affectation publiée, et la plus ancienne dans « Ton programme »', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(
          ['Brumes', 'Néons'],
          published('s1', { kind: 'assigned', gameId: 'Brumes' }),
          published('s2', { kind: 'assigned', gameId: 'Néons' }),
        ),
      );

      expect(data.home()?.card).toMatchObject({ kind: 'assigned', game: neons });
      expect(data.home()?.timeSlots.map(({ assignment }) => assignment)).toEqual([
        { kind: 'assigned', game: brumes },
      ]);
    });

    it('garde la partie double publiée jusqu’à la fin de son second créneau (TI-3)', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Épice'], published('s1', { kind: 'assigned', gameId: 'Épice' })),
      );

      expect(data.home()?.card).toEqual({
        kind: 'assigned',
        game: epice,
        timeSlots: [slot1, slot2],
        started: false,
      });
      expect(programmeRanks(data)).toEqual([]);

      now = new Date(2027, 2, 14, 14, 0);
      await vi.advanceTimersByTimeAsync(30_000);
      await answer('failure');
      expect(data.home()?.card).toEqual({
        kind: 'assigned',
        game: epice,
        timeSlots: [slot1, slot2],
        started: true,
      });
    });

    it('montre « Pas de place pour toi » et les parties du créneau où il reste de la place (story 55)', async () => {
      const full = { ...brumes, playerCount: 5 };
      const ruines = { ...game('Ruines', ['s1']), playerCount: 3 };
      const data = await opened(
        schedule([full, ruines, epice, neons]),
        undefined,
        situation(['Brumes'], published('s1', { kind: 'unassigned' })),
      );

      expect(data.home()?.card).toEqual({
        kind: 'unassigned',
        timeSlot: slot1,
        gamesWithSeats: [ruines],
      });
      expect(programmeRanks(data)).toEqual([2]);
    });

    it('montre « Tirage en cours » à un inscrit sur un créneau en cours de tirage (story 57)', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Brumes', 'Épice'], { ...open('s1'), state: 'drawing' }),
      );

      expect(data.home()?.card).toEqual({
        kind: 'drawing',
        timeSlot: slot1,
        signedUpGames: [brumes, epice],
      });
      expect(programmeRanks(data)).toEqual([2]);
    });

    it('montre « Choisis tes parties » sans inscription sur le créneau en cours de tirage, qui reste dans « Ton programme »', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Néons'], { ...open('s1'), state: 'drawing' }),
      );

      expect(data.home()?.card).toEqual({ kind: 'choose-games' });
      expect(data.home()?.timeSlots.map(({ state }) => state)).toEqual([
        'drawing',
        'sign-ups-open',
      ]);
    });
  });

  describe('MJ qui mène une partie (IN-4, §5.7)', () => {
    /** Il mène « Épice », partie double des créneaux 1 et 2, dont le premier est dans cet état. */
    const leadingEpice = (first: Partial<GivenTimeSlot> = {}) =>
      situation(
        [],
        { ...open('s1'), ledGameId: 'Épice', ...first },
        { ...open('s2'), ledGameId: 'Épice' },
      );
    const [slot1, slot2] = schedule([]).timeSlots as [
      FrontOfficeTimeSlotDto,
      FrontOfficeTimeSlotDto,
    ];

    describe('barre d’inscription de la fiche', () => {
      it('dit « Tu mènes cette partie » sur sa partie, et « Tu mènes une partie sur ce créneau » ailleurs, partie double comprise', async () => {
        const data = await opened(
          undefined,
          undefined,
          situation([], { ...open('s2'), ledGameId: 'Néons' }),
        );

        expect(data.signUpBarOf('Néons')).toEqual({ kind: 'own-game', rank: 2 });
        expect(data.signUpBarOf('Épice')).toEqual({ kind: 'leading', game: neons });
        expect(data.signUpBarOf('Brumes')).toEqual({
          kind: 'open',
          signedUp: false,
          pending: false,
          oversubscribedAfterSignUp: false,
        });
      });

      it('rouvre le créneau d’une partie annulée, qui reste la sienne (TI-6)', async () => {
        const data = await opened(
          undefined,
          undefined,
          situation([], {
            timeSlotId: 's2',
            state: 'published',
            ledGameId: 'Néons',
            drawResult: { kind: 'cancelled' },
          }),
        );

        expect(data.signUpBarOf('Épice')).toEqual({
          kind: 'open',
          signedUp: false,
          pending: false,
          oversubscribedAfterSignUp: false,
        });
        expect(data.ledGameOn('s2')).toBeNull();
        expect(data.signUpBarOf('Néons')).toEqual({ kind: 'own-game', rank: 2 });
      });
    });

    it('donne au programme la partie qu’il mène sur chaque créneau, partie double comprise', async () => {
      const data = await opened(undefined, undefined, leadingEpice());

      expect(data.ledGameOn('s1')).toEqual(epice);
      expect(data.ledGameOn('s2')).toEqual(epice);
    });

    describe('Mes parties', () => {
      const ledOf = (data: ParticipantData) => data.myTimeSlots()?.map(({ led }) => led);

      it('déplie sa partie sur chacun de ses créneaux, avec le nombre d’inscrits avant le tirage', async () => {
        const data = await opened(undefined, undefined, leadingEpice());

        const led = { game: epice, started: false, outcome: { kind: 'sign-ups-open' } };
        expect(ledOf(data)).toEqual([led, led]);
      });

      it('dit « Maintenant » dès le début de sa partie, et la garde sur son second créneau', async () => {
        const data = await opened(undefined, undefined, leadingEpice());

        now = new Date(2027, 2, 14, 11, 30);
        await vi.advanceTimersByTimeAsync(30_000);
        await answer('failure');

        expect(ledOf(data)).toEqual([
          { game: epice, started: true, outcome: { kind: 'sign-ups-open' } },
        ]);
      });

      it('dit « Tirage en cours » pendant le tirage de son premier créneau, sans résultat provisoire', async () => {
        const data = await opened(undefined, undefined, leadingEpice({ state: 'drawing' }));

        expect(ledOf(data)?.map((led) => led?.outcome)).toEqual([
          { kind: 'drawing' },
          { kind: 'drawing' },
        ]);
      });

      it('donne ses joueurs à la publication, et les garde hors ligne', async () => {
        const data = await opened(
          undefined,
          undefined,
          leadingEpice({
            state: 'published',
            drawResult: { kind: 'leading', players: ['Élodie', 'Lune'] },
          }),
        );
        await vi.advanceTimersByTimeAsync(30_000);
        await answer('failure');

        expect(ledOf(data)?.[0]?.outcome).toEqual({ kind: 'players', players: ['Élodie', 'Lune'] });
      });

      it('dit « Partie annulée », avec les parties du créneau où il reste de la place (TI-6)', async () => {
        const withSeats = { ...brumes, playerCount: 3 };
        const data = await opened(
          schedule([withSeats, { ...game('Ruines', ['s1']), playerCount: 5 }, epice, neons]),
          undefined,
          leadingEpice({ state: 'published', drawResult: { kind: 'cancelled' } }),
        );

        expect(ledOf(data)?.[0]?.outcome).toEqual({
          kind: 'cancelled',
          gamesWithSeats: [withSeats],
        });
      });

      it('ne déplie rien sur un créneau où il ne mène pas', async () => {
        const data = await opened(undefined, undefined, situation(['Brumes']));

        expect(ledOf(data)).toEqual([null, null]);
      });
    });

    describe('Accueil', () => {
      it('montre « Tu mènes à la table » quand le dernier tirage publié est celui de sa partie (story 56)', async () => {
        const data = await opened(
          undefined,
          undefined,
          leadingEpice({ state: 'published', drawResult: { kind: 'leading', players: ['Lune'] } }),
        );

        expect(data.home()?.card).toEqual({
          kind: 'leading',
          led: { game: epice, started: false, outcome: { kind: 'players', players: ['Lune'] } },
          timeSlots: [slot1, slot2],
        });
        expect(data.home()?.timeSlots).toEqual([]);
      });

      it('montre « Ta partie est annulée » quand le dernier tirage publié l’annule (TI-6)', async () => {
        const data = await opened(
          undefined,
          undefined,
          leadingEpice({ state: 'published', drawResult: { kind: 'cancelled' } }),
        );

        expect(data.home()?.card).toEqual({
          kind: 'cancelled',
          timeSlot: slot1,
          led: { game: epice, started: false, outcome: { kind: 'cancelled', gamesWithSeats: [] } },
        });
      });

      it('montre « Tirage en cours » avec la partie qu’il mène (story 58)', async () => {
        const data = await opened(undefined, undefined, leadingEpice({ state: 'drawing' }));

        expect(data.home()?.card).toEqual({
          kind: 'leading-drawing',
          timeSlot: slot1,
          led: { game: epice, started: false, outcome: { kind: 'drawing' } },
        });
      });
    });
  });
});
