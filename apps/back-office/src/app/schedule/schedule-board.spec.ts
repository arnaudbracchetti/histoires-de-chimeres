import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  apiUrl,
  scheduleEndpoints,
  type ConventionDto,
  type GameDto,
  type ProblemDto,
  type ScheduleDto,
} from '@chimeres/contract';
import { Notifications } from '../shell/notifications';
import { NBSP } from '../typography/french';
import { ScheduleBoard } from './schedule-board';

const CONVENTION: ConventionDto = {
  id: 'c1',
  name: 'Histoires de Chimères',
  date: null,
  timeSlots: [{ id: 's1', rank: 1, start: '09:00', end: '11:30', availabilityCount: 1 }],
  tables: [{ id: 't1', name: 'Dragon' }],
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
    return { http, host, settle, sheet, unschedule };
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

  it('refusé parce que la partie n’existe plus : notification, puis le programme se relit', async () => {
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
});
