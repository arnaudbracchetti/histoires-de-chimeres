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
const open = (timeSlotId: string): TimeSlotSituation => ({
  timeSlotId,
  state: 'sign-ups-open',
  drawResult: null,
});
/** Inscrit à `signedUpGameIds`, les deux créneaux aux inscriptions ouvertes, sauf ceux donnés. */
const situation = (
  signedUpGameIds: string[] = [],
  ...timeSlots: TimeSlotSituation[]
): ParticipantSituationDto => ({
  signedUpGameIds,
  timeSlots: ['s1', 's2'].map(
    (id) => timeSlots.find(({ timeSlotId }) => timeSlotId === id) ?? open(id),
  ),
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
    const alerts = () => TestBed.inject(Alerts).notices().map(({ title }) => title);

    it('inscrit, attend pendant l’envoi, puis relit : la barre dit « Inscription enregistrée »', async () => {
      const data = await opened();

      const gesture = data.signUp('Brumes');
      expect(data.signUpBarOf('Brumes')).toEqual({ kind: 'open', signedUp: false, pending: true });
      const request = http().expectOne(signUpUrl('Brumes'));
      expect(request.request.method).toBe('PUT');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await vi.advanceTimersByTimeAsync(0);
      await answer(schedule([{ ...brumes, signUpCount: 1 }, epice]), now, situation(['Brumes']));
      await gesture;

      expect(data.signUpBarOf('Brumes')).toEqual({ kind: 'open', signedUp: true, pending: false });
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
      expect(data.signUpBarOf('Brumes')).toEqual({ kind: 'open', signedUp: false, pending: false });
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

      expect(data.signUpBarOf('Brumes')).toEqual({ kind: 'open', signedUp: true, pending: false });
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
      http()
        .expectOne(signUpUrl('Brumes'))
        .flush(
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

    it('dit « Tirage en cours » quand le tirage du premier créneau est lancé', async () => {
      const data = await opened(
        undefined,
        undefined,
        situation(['Épice'], { ...open('s1'), state: 'drawing' }),
      );

      expect(data.signUpBarOf('Épice')).toEqual({ kind: 'drawing', rank: 1, signedUp: true });
      expect(data.signUpBarOf('Néons')).toEqual({ kind: 'open', signedUp: false, pending: false });
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
      expect(data.signUpBarOf('Néons')).toEqual({ kind: 'open', signedUp: false, pending: false });

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
});
