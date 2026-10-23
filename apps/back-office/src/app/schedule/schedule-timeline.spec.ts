import { TestBed } from '@angular/core/testing';
import type { GameDto, TableDto, TimeSlotDto } from '@chimeres/contract';
import { ScheduleTimeline } from './schedule-timeline';

const NBSP = ' ';

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
  async function render(games: GameDto[] = [GAME]) {
    const fixture = TestBed.createComponent(ScheduleTimeline);
    fixture.componentRef.setInput('timeSlots', TIME_SLOTS);
    fixture.componentRef.setInput('tables', TABLES);
    fixture.componentRef.setInput('games', games);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \n\t]+/g, ' ').trim();
    return { host, text };
  }

  it('donne à chaque créneau une largeur proportionnelle à sa durée, et une colonne étroite à chaque pause', async () => {
    const { host, text } = await render();

    const grid = host.querySelector<HTMLElement>('[role="table"]')!;
    expect(grid.style.gridTemplateColumns).toBe(
      'fit-content(10rem) minmax(120px, 150fr) minmax(3rem, max-content) minmax(144px, 180fr) minmax(120px, 150fr)',
    );
    const headers = [...host.querySelectorAll('[role="columnheader"]')].map(text);
    expect(headers).toEqual([
      `Créneau 1 9${NBSP}h${NBSP}00 – 11${NBSP}h${NBSP}30`,
      `Pause de 1${NBSP}h`,
      `Créneau 2 12${NBSP}h${NBSP}30 – 15${NBSP}h${NBSP}30`,
      `Créneau 3 15${NBSP}h${NBSP}30 – 18${NBSP}h${NBSP}00`,
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
    expect(cells.map((cell) => cell.querySelector('.game')?.id ?? '')).toEqual([
      '',
      '',
      'game-p1',
      '',
    ]);
    const card = host.querySelector('#game-p1')!;
    expect([...card.querySelectorAll('.text > *')].map(text)).toEqual([
      'Néons sur Neo-Paris',
      'Cyberpunk',
      'Kaïros',
      '3 à 5 places',
    ]);
    expect(card.querySelector('app-scenario-illustration')).not.toBeNull();
  });
});
