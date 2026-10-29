import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import {
  apiUrl,
  frontOfficeEndpoints,
  type FrontOfficeGameDto,
  type FrontOfficeScheduleDto,
} from '@chimeres/contract';
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

describe('ParticipantData', () => {
  let now: Date;
  const visible = signal(true);

  beforeEach(() => {
    vi.useFakeTimers();
    now = new Date(2027, 2, 14, 8, 0);
    visible.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLocationMocks(),
        provideRouter([{ path: '**', children: [] }]),
        ParticipantData,
        { provide: PhoneClock, useValue: { now: () => now } },
        { provide: PageVisibility, useValue: { visible } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  const http = () => TestBed.inject(HttpTestingController);
  const reads = () => http().match(apiUrl(frontOfficeEndpoints.readSchedule));

  /** Répond à la lecture en attente, et laisse le module la ranger. */
  async function answer(dto: FrontOfficeScheduleDto | 'failure'): Promise<void> {
    const request = http().expectOne(apiUrl(frontOfficeEndpoints.readSchedule));
    if (dto === 'failure') request.flush(null, { status: 502, statusText: 'Bad Gateway' });
    else request.flush(dto);
    await vi.advanceTimersByTimeAsync(0);
  }

  /** Le module, ouvert, avec sa première lecture servie. */
  async function opened(dto = schedule([brumes, epice])): Promise<ParticipantData> {
    const data = TestBed.inject(ParticipantData);
    await answer(dto);
    // La relecture toutes les 30 s attend que l'application soit stable.
    await TestBed.inject(ApplicationRef).whenStable();
    return data;
  }

  it('lit le programme à l’ouverture', async () => {
    const data = await opened();

    expect(data.schedule()?.games.map(({ id }) => id)).toEqual(['Brumes', 'Épice']);
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

    expect(data.schedule()?.games.map(({ id }) => id)).toEqual(['Brumes', 'Épice']);
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
    expect(data.schedule()?.games).toEqual([]);
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
});
