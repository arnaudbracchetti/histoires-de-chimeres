import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  apiUrl,
  scheduleEndpoints,
  type PlacementDto,
  type ProblemDto,
  type ScheduleDto,
  type ScheduleScenarioDto,
  type TableDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { Placements } from './placement-dialog';

const TIME_SLOTS: TimeSlotDto[] = [
  { id: 's1', rank: 1, start: '09:00', end: '11:30', availabilityCount: 2 },
  { id: 's2', rank: 2, start: '14:00', end: '16:30', availabilityCount: 1 },
];

const TABLES: TableDto[] = [
  { id: 't1', name: 'Table 1' },
  { id: 't2', name: 'Table 2' },
];

const SCENARIO: ScheduleScenarioDto = {
  id: 'a',
  title: 'Brumes',
  system: 'Cthulhu',
  seats: { min: 3, max: 5 },
  duration: 1,
  imageUrl: null,
  gameMaster: { id: 'g2', nickname: 'Kaïros' },
};

const refused = (code: 'table-taken' | 'game-master-unavailable' | 'game-master-busy') =>
  ({
    'table-taken': {
      code,
      title: 'Table prise',
      detail: 'La table « Table 1 » accueille déjà une partie sur le créneau 1.',
    },
    'game-master-unavailable': {
      code,
      title: 'MJ indisponible',
      detail: "Kaïros n'est pas disponible sur le créneau 2.",
    },
    'game-master-busy': {
      code,
      title: 'MJ déjà occupé',
      detail: 'Kaïros mène déjà une partie sur le créneau 2.',
    },
  })[code];

const PLACEMENTS: PlacementDto[] = [
  { timeSlotId: 's1', tableId: 't1', refusal: refused('table-taken') },
  { timeSlotId: 's1', tableId: 't2', refusal: null },
  { timeSlotId: 's2', tableId: 't1', refusal: refused('game-master-unavailable') },
  { timeSlotId: 's2', tableId: 't2', refusal: refused('game-master-busy') },
];

const SCHEDULE: ScheduleDto = { games: [], reserve: [] };

describe('PlacementDialog', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  /** Pas de `whenStable()` : la lecture de la grille, en attente, garde l'application instable. */
  const settle = async () => {
    for (let i = 0; i < 2; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.inject(ApplicationRef).tick();
    }
  };

  async function open() {
    const http = TestBed.inject(HttpTestingController);
    const closed = TestBed.inject(Placements).scheduleOn({
      scenario: SCENARIO,
      timeSlots: TIME_SLOTS,
      tables: TABLES,
    });
    await settle();
    const dialog = () => document.querySelector<HTMLElement>('app-placement-dialog')!;
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \n\t]+/g, ' ').trim();
    /** Le contenu de chaque case, ligne par ligne : « Choisir » ou le motif. */
    const grid = () =>
      [...dialog().querySelectorAll('tbody tr')].map((row) => [
        text(row.querySelector('th')),
        ...[...row.querySelectorAll('td')].map(
          (cell) =>
            text(cell.querySelector('button')) ??
            cell.querySelector('.off')!.firstChild!.textContent!.trim(),
        ),
      ]);
    const flushPlacements = async (placements = PLACEMENTS) => {
      http.expectOne(apiUrl(scheduleEndpoints.placements, { scenarioId: 'a' })).flush(placements);
      await settle();
    };
    return { http, closed, dialog, grid, text, flushPlacements };
  }

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((overlay) => overlay.remove());
  });

  it('lit la grille à l’ouverture, et éteint chaque case refusée avec son motif', async () => {
    const { dialog, grid, text, flushPlacements } = await open();
    await flushPlacements();

    expect(text(dialog().querySelector('h2'))).toBe('Programmer « Brumes » sur…');
    expect(grid()).toEqual([
      ['Table 1', 'Table prise', 'MJ indisponible'],
      ['Table 2', 'Choisir', 'MJ déjà occupé'],
    ]);
    const off = dialog().querySelector('.off')!;
    expect(off.getAttribute('title')).toBe(
      'La table « Table 1 » accueille déjà une partie sur le créneau 1.',
    );
    expect(dialog().querySelectorAll('button[aria-label^="Choisir"]')).toHaveLength(1);
  });

  it('met le focus sur la première case libre, une fois la grille lue', async () => {
    const { dialog, flushPlacements } = await open();
    await flushPlacements();

    expect(document.activeElement?.getAttribute('aria-label')).toBe(
      'Choisir Créneau 1 · 9\u00a0h\u00a000\u202f–\u202f11\u00a0h\u00a030, Table 2',
    );
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it('programme la partie sur la case choisie, et se ferme sur le programme relu', async () => {
    const { http, closed, dialog, flushPlacements } = await open();
    await flushPlacements();

    dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!.click();
    const request = http.expectOne(apiUrl(scheduleEndpoints.schedule));
    expect(request.request.body).toEqual({ scenarioId: 'a', timeSlotId: 's1', tableId: 't2' });
    request.flush(SCHEDULE);

    expect(await closed).toEqual(SCHEDULE);
  });

  it('affiche un refus dans le dialogue, et relit la grille', async () => {
    const { http, dialog, flushPlacements, grid } = await open();
    await flushPlacements();
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:table-taken',
      title: 'Table prise',
      status: 422,
      detail: 'La table « Table 2 » accueille déjà une partie sur le créneau 1.',
      code: 'table-taken',
    };

    dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!.click();
    http
      .expectOne(apiUrl(scheduleEndpoints.schedule))
      .flush(problem, { status: 422, statusText: 'Refus' });
    await settle();

    expect(dialog().querySelector('[role="alert"]')?.textContent).toBe(problem.detail);
    await flushPlacements(
      PLACEMENTS.map((verdict) =>
        verdict.refusal ? verdict : { ...verdict, refusal: refused('table-taken') },
      ),
    );
    expect(grid()[1]).toEqual(['Table 2', 'Table prise', 'MJ déjà occupé']);
  });
});
