import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { GameDto, TableDto, TimeSlotDto } from '@chimeres/contract';
import { NBSP, THIN_NBSP } from '@chimeres/design';
import { ScheduleDrag } from './schedule-drag';
import { ScheduleTimeline } from './schedule-timeline';

/** Créneau 1 de 2 h 30, pause de 1 h, créneau 2 de 3 h, puis créneau 3 collé au 2. */
const TIME_SLOTS: TimeSlotDto[] = [
  { id: 's1', rank: 1, start: '09:00', end: '11:30', availabilityCount: 0 },
  { id: 's2', rank: 2, start: '12:30', end: '15:30', availabilityCount: 0 },
  { id: 's3', rank: 3, start: '15:30', end: '18:00', availabilityCount: 0 },
];

const TABLES: TableDto[] = [
  { id: 't1', name: 'Table 1' },
  { id: 't2', name: 'Dragon' },
];

const GAME: GameDto = {
  id: 'p1',
  tableId: 't2',
  timeSlotIds: ['s2'],
  seats: { min: 3, max: 5 },
  scenario: {
    id: 'a',
    title: 'Néons sur Neo-Paris',
    system: 'Cyberpunk',
    seats: { min: 3, max: 5 },
    duration: 1,
    imageUrl: null,
    gameMaster: { id: 'g1', nickname: 'Kaïros' },
  },
};

describe('ScheduleTimeline', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ScheduleDrag, provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render(games: GameDto[] = [GAME]) {
    const fixture = TestBed.createComponent(ScheduleTimeline);
    const opened: GameDto[] = [];
    fixture.componentInstance.opened.subscribe((game) => opened.push(game));
    fixture.componentRef.setInput('timeSlots', TIME_SLOTS);
    fixture.componentRef.setInput('tables', TABLES);
    fixture.componentRef.setInput('games', games);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \n\t]+/g, ' ').trim();
    return { fixture, host, text, opened };
  }

  it('donne à chaque créneau une largeur proportionnelle à sa durée, et une colonne étroite à chaque pause', async () => {
    const { host, text } = await render();

    const grid = host.querySelector<HTMLElement>('[role="table"]')!;
    expect(grid.style.gridTemplateColumns).toBe(
      'fit-content(10rem) minmax(120px, 150fr) minmax(3rem, max-content) minmax(144px, 180fr) minmax(120px, 150fr)',
    );
    const headers = [...host.querySelectorAll('[role="columnheader"]')].map(text);
    expect(headers).toEqual([
      `Créneau 1 9${NBSP}h${NBSP}00${THIN_NBSP}–${THIN_NBSP}11${NBSP}h${NBSP}30`,
      `Pause de 1${NBSP}h`,
      `Créneau 2 12${NBSP}h${NBSP}30${THIN_NBSP}–${THIN_NBSP}15${NBSP}h${NBSP}30`,
      `Créneau 3 15${NBSP}h${NBSP}30${THIN_NBSP}–${THIN_NBSP}18${NBSP}h${NBSP}00`,
    ]);
  });

  it('donne une ligne par table, et place chaque partie dans sa case', async () => {
    const { host, text } = await render();

    const rows = [...host.querySelectorAll('[role="row"]')].slice(1);
    expect(rows.map((row) => text(row.querySelector('[role="rowheader"]')))).toEqual([
      'Table 1',
      'Dragon',
    ]);
    const cells = [...rows[1]!.querySelectorAll('[role="cell"]')];
    expect(cells.map((cell) => cell.querySelector('.game button')?.id ?? '')).toEqual([
      '',
      '',
      'game-p1',
      '',
    ]);
    const card = host.querySelector('#game-p1')!.closest('.game')!;
    expect([...card.querySelectorAll('.text > *')].map(text)).toEqual([
      'Néons sur Neo-Paris',
      'Cyberpunk',
      'Kaïros',
      `3 à 5${NBSP}places`,
    ]);
    expect(card.querySelector('app-scenario-illustration')).not.toBeNull();
  });

  it('étend la carte d’une partie double sur ses deux créneaux, par-dessus la pause, avec « double »', async () => {
    const double: GameDto = {
      ...GAME,
      id: 'p2',
      tableId: 't1',
      timeSlotIds: ['s1', 's2'],
      scenario: { ...GAME.scenario, duration: 2 },
    };
    const { host, text } = await render([GAME, double]);

    const [doubleRow, singleRow] = [...host.querySelectorAll('[role="row"]')].slice(1);
    const cells = [...doubleRow!.querySelectorAll('[role="cell"]')];
    expect(cells.map((cell) => cell.querySelector('.game button')?.id ?? '')).toEqual([
      'game-p2',
      '',
    ]);
    expect(cells[0]!.getAttribute('aria-colspan')).toBe('3');
    expect((cells[0] as HTMLElement).style.gridColumn).toBe('span 3');
    expect(text(cells[0]!.querySelector('app-two-slot-badge'))).toBe('double');
    const single = singleRow!.querySelector('[role="cell"]:has(#game-p1)')!;
    expect(single.getAttribute('aria-colspan')).toBeNull();
    expect(single.querySelector('app-two-slot-badge')).toBeNull();
  });

  it('ouvre la fiche d’une partie au clic, et marque la partie ouverte', async () => {
    const { fixture, host, opened } = await render();
    const button = host.querySelector<HTMLButtonElement>('#game-p1')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    fixture.componentRef.setInput('selectedGameId', 'p1');
    await fixture.whenStable();

    expect(opened).toEqual([GAME]);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe('game-sheet');
  });
});
