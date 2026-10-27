import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  apiUrl,
  availabilityEndpoints,
  type GameMasterGameDto,
  type GameMasterSheetDto,
  type ProblemDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { Alerts } from '../shell/alerts';
import { NBSP, THIN_NBSP } from '../typography/french';
import { AvailabilityTimeline } from './availability-timeline';

const TIME_SLOTS: TimeSlotDto[] = [
  { id: 's1', rank: 1, start: '09:00', end: '12:30', availabilityCount: 1 },
  { id: 's2', rank: 2, start: '14:00', end: '16:30', availabilityCount: 0 },
];

describe('AvailabilityTimeline', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  /** Les disponibilités du MJ ; chacune se retire, sauf sous une partie de `games`. */
  async function render(availabilities: string[], games: GameMasterGameDto[] = []) {
    const fixture = TestBed.createComponent(AvailabilityTimeline);
    const gameMaster: GameMasterSheetDto = {
      id: 'g1',
      nickname: 'Élodie',
      availabilities,
      scenarios: [],
      games,
      withdrawals: availabilities.map((timeSlotId) => ({
        timeSlotId,
        refusal: games.some((game) => game.timeSlotId === timeSlotId)
          ? {
              code: 'availability-has-game',
              title: 'Disponibilité programmée',
              detail: "Élodie mène une partie sur le créneau 2 : déprogramme-la d'abord.",
            }
          : null,
      })),
    };
    fixture.componentRef.setInput('gameMaster', gameMaster);
    fixture.componentRef.setInput('timeSlots', TIME_SLOTS);
    const changed: GameMasterSheetDto[] = [];
    fixture.componentInstance.changed.subscribe((value) => changed.push(value));
    let refusals = 0;
    fixture.componentInstance.refused.subscribe(() => refusals++);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    const blocks = () => [...host.querySelectorAll<HTMLElement>('label.block')];
    const box = (rank: number) => blocks()[rank - 1]!.querySelector('input')!;
    /** Chaque bloc : le nom de sa case, cochée ou non, son état écrit, atténué ou non. */
    const state = () =>
      blocks().map((block) => {
        const input = block.querySelector('input')!;
        const pending = block.classList.contains('pending') ? ' atténué' : '';
        return `${input.getAttribute('aria-label')} ${input.checked ? '☑' : '☐'} ${text(block.querySelector('.state'))}${pending}`;
      });
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find((b) => text(b) === name)!;
    const click = async (rank: number) => {
      box(rank).click();
      await fixture.whenStable();
    };
    return {
      fixture,
      http,
      blocks,
      box,
      state,
      click,
      button,
      changed,
      refusals: () => refusals,
    };
  }

  it('un bloc par créneau, « Créneau 1 · 9 h 00 – 12 h 30 », coché là où le MJ peut mener une partie', async () => {
    const { state } = await render(['s1']);

    expect(state()).toEqual([
      `Créneau 1 · 9${NBSP}h${NBSP}00${THIN_NBSP}–${THIN_NBSP}12${NBSP}h${NBSP}30 ☑ Je peux mener une partie`,
      `Créneau 2 · 14${NBSP}h${NBSP}00${THIN_NBSP}–${THIN_NBSP}16${NBSP}h${NBSP}30 ☐ Pas disponible`,
    ]);
  });

  it('une disponibilité où le MJ mène une partie est cochée et verrouillée, avec son motif et sa table (PR-15)', async () => {
    const { http, blocks, box, click, button } = await render(
      ['s1', 's2'],
      [
        {
          gameId: 'p1',
          timeSlotId: 's2',
          table: { id: 't1', name: 'Table verte' },
          scenario: { id: 'sc1', title: 'Néons sur Neo-Paris' },
        },
      ],
    );

    const [first, second] = blocks();
    expect(first!.querySelector('.game')).toBeNull();
    expect(box(1).disabled).toBe(false);
    const game = second!.querySelector('.game')!;
    expect([...game.children].map((line) => line.textContent)).toEqual([
      `Mène «${NBSP}Néons sur Neo-Paris${NBSP}»`,
      'Table verte',
    ]);
    expect(box(2).checked).toBe(true);
    expect(box(2).disabled).toBe(true);
    expect(second!.classList).toContain('locked');
    expect(second!.title).toBe("Élodie mène une partie sur le créneau 2 : déprogramme-la d'abord.");
    expect(box(2).getAttribute('aria-describedby')).toBe(game.id);

    await click(2);
    button('Aucun créneau').click();
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne(
      apiUrl(availabilityEndpoints.withdraw, { gameMasterId: 'g1', timeSlotId: 's1' }),
    );
    http.expectNone(
      apiUrl(availabilityEndpoints.withdraw, { gameMasterId: 'g1', timeSlotId: 's2' }),
    );
  });

  it('découpe la journée de 9 h à 17 h en créneaux et pauses, chacun large de sa durée', async () => {
    const { fixture, blocks } = await render([]);

    const day = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.day')!;
    expect(day.style.gridTemplateColumns).toBe(
      'minmax(var(--slot-min), 210fr) minmax(0, 90fr) minmax(var(--slot-min), 150fr) minmax(0, 30fr)',
    );
    expect(blocks().map((block) => block.style.gridColumn)).toEqual(['1 / 2', '3 / 4']);
  });

  it('« Toute la journée » déclare un à un les créneaux qui manquent', async () => {
    const { http, button, changed } = await render(['s1']);

    button('Toute la journée').click();
    await new Promise((resolve) => setTimeout(resolve));

    http
      .expectOne(apiUrl(availabilityEndpoints.declare, { gameMasterId: 'g1', timeSlotId: 's2' }))
      .flush({ id: 'g1', nickname: 'Élodie', availabilities: ['s1', 's2'] });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectNone(
      apiUrl(availabilityEndpoints.declare, { gameMasterId: 'g1', timeSlotId: 's1' }),
    );
    expect(changed.at(-1)?.availabilities).toEqual(['s1', 's2']);
  });

  it('cocher déclare la disponibilité : bloc atténué pendant l’écriture, puis la fiche suit', async () => {
    const { http, state, click, changed } = await render([]);

    await click(2);
    expect(state()[1]).toMatch(/☑ Je peux mener une partie atténué$/);

    const request = http.expectOne(
      apiUrl(availabilityEndpoints.declare, { gameMasterId: 'g1', timeSlotId: 's2' }),
    );
    expect(request.request.method).toBe('PUT');
    request.flush({ id: 'g1', nickname: 'Élodie', availabilities: ['s2'] });
    await new Promise((resolve) => setTimeout(resolve));

    expect(changed).toEqual([{ id: 'g1', nickname: 'Élodie', availabilities: ['s2'] }]);
  });

  it('décocher retire la disponibilité ; refusée, le bloc revient coché, le refus reste affiché, et l’écran est à relire', async () => {
    const { fixture, http, state, click, changed, refusals } = await render(['s1']);

    await click(1);
    expect(state()[0]).toMatch(/☐ Pas disponible atténué$/);

    const request = http.expectOne(
      apiUrl(availabilityEndpoints.withdraw, { gameMasterId: 'g1', timeSlotId: 's1' }),
    );
    expect(request.request.method).toBe('DELETE');
    const problem: Partial<ProblemDto> = {
      status: 404,
      code: 'time-slot-not-found',
      title: 'Créneau introuvable',
      detail: "Ce créneau n'existe plus : recharge la page.",
    };
    request.flush(problem, { status: 404, statusText: 'Introuvable' });
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();

    expect(state()[0]).toMatch(/☑ Je peux mener une partie$/);
    expect(changed).toEqual([]);
    expect(refusals()).toBe(1);
    expect(TestBed.inject(Alerts).notices()).toEqual([
      expect.objectContaining({ title: 'Créneau introuvable', detail: problem.detail }),
    ]);
  });
});
