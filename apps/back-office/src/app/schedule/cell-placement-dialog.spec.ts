import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  apiUrl,
  scheduleEndpoints,
  type CellPlacementDto,
  type ProblemDto,
  type ScheduleDto,
  type ScheduleScenarioDto,
  type TableDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { CellPlacements } from './cell-placement-dialog';

const TIME_SLOT: TimeSlotDto = {
  id: 's2',
  rank: 2,
  start: '14:00',
  end: '16:30',
  availabilityCount: 2,
};

const TABLE: TableDto = { id: 't1', name: 'Dragon' };

const scenario = (id: string, title: string, nickname = 'Kaïros'): ScheduleScenarioDto => ({
  id,
  title,
  system: 'Cthulhu',
  seats: { min: 3, max: 5 },
  duration: 1,
  imageUrl: null,
  gameMaster: { id: `g-${nickname}`, nickname },
});

/** Dans l'ordre de l'API : les programmables d'abord. */
const PLACEMENTS: CellPlacementDto[] = [
  { scenario: scenario('a', 'Abysses'), refusal: null },
  { scenario: scenario('b', 'Brumes'), refusal: null },
  {
    scenario: scenario('c', 'Cendres', 'Élodie'),
    refusal: {
      code: 'game-master-unavailable',
      title: 'MJ indisponible',
      detail: "Élodie n'est pas disponible sur le créneau 2.",
    },
  },
];

const SCHEDULE: ScheduleDto = { games: [], reserve: [] };

describe('CellPlacementDialog', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((overlay) => overlay.remove());
    document.querySelectorAll('.opener').forEach((opener) => opener.remove());
  });

  /** Pas de `whenStable()` : la lecture des verdicts, en attente, garde l'application instable. */
  const settle = async () => {
    for (let i = 0; i < 2; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.inject(ApplicationRef).tick();
    }
  };

  /** Ouvre le dialogue depuis un bouton, qui a le focus, puis sert les verdicts. */
  async function open(placements = PLACEMENTS) {
    const http = TestBed.inject(HttpTestingController);
    const opener = document.createElement('button');
    opener.className = 'opener';
    document.body.append(opener);
    opener.focus();
    const closed = TestBed.inject(CellPlacements).scheduleOn({ timeSlot: TIME_SLOT, table: TABLE });
    await settle();
    const flushPlacements = async (next = placements) => {
      http
        .expectOne(apiUrl(scheduleEndpoints.cellPlacements, { timeSlotId: 's2', tableId: 't1' }))
        .flush(next);
      await settle();
    };
    await flushPlacements();
    const dialog = () => document.querySelector<HTMLElement>('app-cell-placement-dialog')!;
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \n\t]+/g, ' ').trim();
    const items = () => [...dialog().querySelectorAll('li')];
    const choose = (title: string) =>
      items()
        .find((item) => text(item.querySelector('h3')) === title)!
        .querySelector('button')!
        .click();
    return { http, opener, closed, dialog, text, items, choose, flushPlacements };
  }

  it('lit les verdicts de la case à l’ouverture : les programmables, puis les autres avec leur motif', async () => {
    const { dialog, text } = await open();

    expect(text(dialog().querySelector('h2'))).toBe('Programmer sur le créneau 2, table Dragon');
    const [schedulable, others] = [...dialog().querySelectorAll('section')];
    expect([...schedulable!.querySelectorAll('h3')].map(text)).toEqual(['Abysses', 'Brumes']);
    expect([...schedulable!.querySelectorAll('button')].map(text)).toEqual(['Choisir', 'Choisir']);
    expect(text(others!.querySelector('h3'))?.replaceAll(NBSP, ' ')).toBe(
      'Pas programmables ici · 1',
    );
    const card = others!.querySelector('app-reserve-scenario-card')!;
    expect(card.classList).toContain('unschedulable');
    expect(text(card)).toContain("Élodie n'est pas disponible sur le créneau 2.");
    expect(card.querySelector('button')).toBeNull();
  });

  it('met le focus sur le premier « Choisir »', async () => {
    const { items } = await open();

    expect(document.activeElement).toBe(items()[0]!.querySelector('button'));
  });

  it('dit qu’aucun scénario n’est programmable ici, et met le focus sur « Annuler »', async () => {
    const { dialog, text } = await open(PLACEMENTS.slice(2));

    expect(text(dialog())).toContain('Aucun scénario programmable ici.');
    expect(text(dialog().querySelector('h3'))?.replaceAll(NBSP, ' ')).toBe(
      'Pas programmables ici · 1',
    );
    expect(text(document.activeElement)).toBe('Annuler');
  });

  it('« Annuler » se ferme sans rien écrire, et rend le focus au bouton qui l’a ouvert', async () => {
    const { http, opener, closed, dialog } = await open();

    dialog().querySelector<HTMLButtonElement>('.cancel')!.click();

    expect(await closed).toBeUndefined();
    await settle();
    http.verify();
    expect(document.activeElement).toBe(opener);
  });

  it('« Choisir » programme le scénario sur la case, et se ferme sur le programme relu', async () => {
    const { http, closed, choose } = await open();

    choose('Brumes');
    const request = http.expectOne(apiUrl(scheduleEndpoints.schedule));
    expect(request.request.body).toEqual({ scenarioId: 'b', timeSlotId: 's2', tableId: 't1' });
    request.flush(SCHEDULE);

    expect(await closed).toEqual(SCHEDULE);
  });

  it('affiche un refus dans le dialogue, et relit les verdicts', async () => {
    const { http, dialog, choose, flushPlacements, items, text } = await open();
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:table-taken',
      title: 'Table prise',
      status: 422,
      detail: `La table «${NBSP}Dragon${NBSP}» accueille déjà une partie sur le créneau 2.`,
      code: 'table-taken',
    };

    choose('Abysses');
    http
      .expectOne(apiUrl(scheduleEndpoints.schedule))
      .flush(problem, { status: 422, statusText: 'Refus' });
    await settle();

    expect(dialog().querySelector('[role="alert"]')?.textContent).toBe(problem.detail);
    await flushPlacements([PLACEMENTS[1]!, PLACEMENTS[2]!]);
    expect(items().map((item) => text(item.querySelector('h3')))).toEqual(['Brumes', 'Cendres']);
  });
});
