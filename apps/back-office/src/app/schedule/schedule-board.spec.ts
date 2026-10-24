import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  apiUrl,
  conventionEndpoints,
  scheduleEndpoints,
  type ConventionDto,
  type GameDto,
  type ProblemDto,
  type ScheduleDto,
} from '@chimeres/contract';
import { Notifications } from '../shell/notifications';
import { NBSP } from '../typography/french';
import { ScheduleBoard } from './schedule-board';
import type { Drop } from './schedule-drag';
import { ScheduleTimeline } from './schedule-timeline';

const CONVENTION: ConventionDto = {
  id: 'c1',
  name: 'Histoires de Chimères',
  date: null,
  timeSlots: [{ id: 's1', rank: 1, start: '09:00', end: '11:30', availabilityCount: 1 }],
  tables: [
    { id: 't1', name: 'Dragon' },
    { id: 't2', name: 'Licorne' },
  ],
};

const GAME: GameDto = {
  id: 'p1',
  tableId: 't1',
  timeSlotIds: ['s1'],
  seats: { min: 3, max: 5 },
  scenario: {
    id: 'a',
    title: 'Brumes',
    system: 'Cthulhu',
    seats: { min: 3, max: 5 },
    duration: 1,
    imageUrl: null,
    gameMaster: { id: 'g1', nickname: 'Kaïros' },
  },
};

const SCHEDULED: ScheduleDto = { games: [GAME], reserve: [] };
const UNSCHEDULED: ScheduleDto = {
  games: [],
  reserve: [
    {
      ...GAME.scenario,
      timeSlots: [{ timeSlotId: 's1', inReserve: true, scheduled: false }],
      unschedulable: null,
    },
  ],
};

describe('ScheduleBoard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ScheduleBoard);
    fixture.componentRef.setInput('convention', CONVENTION);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.match(apiUrl(conventionEndpoints.read)).forEach((read) => read.flush(CONVENTION));
    http.expectOne(apiUrl(scheduleEndpoints.read)).flush(SCHEDULED);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/[ \t\n]+/g, ' ').trim() ?? '';
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find((b) => text(b) === name)!;
    const sheet = () => host.querySelector('app-game-sheet');
    const unschedule = async () => {
      host.querySelector<HTMLButtonElement>('#game-p1')!.click();
      await settle();
      button('Déprogrammer').click();
      await fixture.whenStable();
      return http.expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }));
    };
    /** Lâche la partie sur une case de la frise. */
    const drop = async (target: Drop['target']) => {
      const timeline = fixture.debugElement.query(By.directive(ScheduleTimeline));
      (timeline.componentInstance as ScheduleTimeline).dropped.emit({
        subject: { kind: 'game', game: GAME },
        target,
      });
      await fixture.whenStable();
    };
    /** La partie de la case, et si elle y est atténuée. */
    const gameAt = (timeSlotId: string, tableId: string) => {
      const game = host.querySelector(
        `[data-drop-time-slot="${timeSlotId}"][data-drop-table="${tableId}"] .game`,
      );
      return game && { title: text(game.querySelector('h3')), pending: game.matches('.pending') };
    };
    return { http, host, settle, sheet, unschedule, drop, gameAt };
  }

  it('« Déprogrammer » ferme la fiche, et le scénario revient dans la réserve', async () => {
    const { http, host, settle, sheet, unschedule } = await render();

    const request = await unschedule();
    expect(sheet()?.getAttribute('aria-busy')).toBe('true');
    request.flush(UNSCHEDULED);
    await settle();

    expect(sheet()).toBeNull();
    expect(host.querySelector('#game-p1')).toBeNull();
    expect(host.querySelector('app-reserve-tray h3')?.textContent).toBe('Brumes');
    http.verify();
  });

  it('refusé parce que la partie n’existe plus : notification, puis la convention et le programme se relisent', async () => {
    const { http, settle, sheet, unschedule } = await render();
    const problem: Partial<ProblemDto> = {
      status: 404,
      code: 'game-not-found',
      title: 'Partie introuvable',
      detail: "Cette partie n'existe plus : recharge la page.",
    };

    (await unschedule()).flush(problem, { status: 404, statusText: 'Introuvable' });
    // Pas de `whenStable()` avant d'avoir servi la relecture : elle garde l'application instable.
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();

    expect(TestBed.inject(Notifications).notices()).toEqual([
      expect.objectContaining({ title: 'Partie introuvable', detail: problem.detail }),
    ]);
    http.expectOne(apiUrl(conventionEndpoints.read)).flush(CONVENTION);
    http.expectOne(apiUrl(scheduleEndpoints.read)).flush(UNSCHEDULED);
    await settle();
    expect(sheet()).toBeNull();
  });

  it('après une coupure : notification, la fiche reste ouverte, sans relecture', async () => {
    const { http, settle, sheet, unschedule } = await render();

    (await unschedule()).error(new ProgressEvent('error'), { status: 0 });
    await settle();

    expect(sheet()).not.toBeNull();
    expect(TestBed.inject(Notifications).notices()).toEqual([
      expect.objectContaining({ title: `Pas de connexion${NBSP}: rien n'a été enregistré.` }),
    ]);
    http.verify();
  });

  describe('glisser-déposer', () => {
    const toLicorne = { kind: 'cell', timeSlotId: 's1', tableId: 't2', gameId: null } as const;
    const MOVED: ScheduleDto = { games: [{ ...GAME, tableId: 't2' }], reserve: [] };

    it('pendant l’écriture, la partie est à sa nouvelle place, atténuée ; puis le focus y va', async () => {
      const { http, settle, drop, gameAt } = await render();

      await drop(toLicorne);
      expect(gameAt('s1', 't1')).toBeNull();
      expect(gameAt('s1', 't2')).toEqual({ title: 'Brumes', pending: true });

      const request = http.expectOne(apiUrl(scheduleEndpoints.move, { gameId: 'p1' }));
      expect(request.request.body).toEqual({ timeSlotId: 's1', tableId: 't2' });
      request.flush(MOVED);
      await settle();

      expect(gameAt('s1', 't2')).toEqual({ title: 'Brumes', pending: false });
      expect(document.activeElement?.id).toBe('game-p1');
      http.verify();
    });

    it('refusée (422) : la partie revient à sa place, notification, puis la convention et le programme se relisent', async () => {
      const { http, settle, drop, gameAt } = await render();
      const problem: Partial<ProblemDto> = {
        status: 422,
        code: 'table-taken',
        title: 'Table prise',
        detail: `La table « Licorne » accueille déjà une partie sur le créneau 1${NBSP}: choisis une autre table.`,
      };

      await drop(toLicorne);
      http
        .expectOne(apiUrl(scheduleEndpoints.move, { gameId: 'p1' }))
        .flush(problem, { status: 422, statusText: 'Refusé' });
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();

      expect(gameAt('s1', 't1')).toEqual({ title: 'Brumes', pending: false });
      expect(gameAt('s1', 't2')).toBeNull();
      expect(TestBed.inject(Notifications).notices()).toEqual([
        expect.objectContaining({ title: 'Table prise', detail: problem.detail }),
      ]);
      http.expectOne(apiUrl(conventionEndpoints.read)).flush(CONVENTION);
      http.expectOne(apiUrl(scheduleEndpoints.read)).flush(SCHEDULED);
      await settle();
      http.verify();
    });

    it('en conflit (409) : notification « l’écran est à jour », puis la convention et le programme se relisent', async () => {
      const { http, settle, drop, gameAt } = await render();

      await drop(toLicorne);
      http
        .expectOne(apiUrl(scheduleEndpoints.move, { gameId: 'p1' }))
        .flush(
          { status: 409, code: 'concurrent-modification', title: 'Modification simultanée' },
          { status: 409, statusText: 'Conflit' },
        );
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();

      expect(gameAt('s1', 't1')).toEqual({ title: 'Brumes', pending: false });
      expect(TestBed.inject(Notifications).notices()).toEqual([
        expect.objectContaining({
          title: 'Modification simultanée',
          detail: `La convention a changé entre-temps${NBSP}: l'écran est à jour.`,
        }),
      ]);
      http.expectOne(apiUrl(conventionEndpoints.read)).flush(CONVENTION);
      http.expectOne(apiUrl(scheduleEndpoints.read)).flush(MOVED);
      await settle();
      expect(gameAt('s1', 't2')).toEqual({ title: 'Brumes', pending: false });
      http.verify();
    });
  });
});
