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
  type UnscheduleVerdictDto,
} from '@chimeres/contract';
import { Alerts } from '../shell/alerts';
import { NBSP, THIN_NBSP } from '@chimeres/design';
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
  end: null,
  presenceCode: 'K7M2',
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

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((overlay) => overlay.remove());
  });

  async function render(convention = CONVENTION, scheduled = SCHEDULED) {
    const fixture = TestBed.createComponent(ScheduleBoard);
    fixture.componentRef.setInput('convention', convention);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.match(apiUrl(conventionEndpoints.read)).forEach((read) => read.flush(convention));
    http.expectOne(apiUrl(scheduleEndpoints.read)).flush(scheduled);
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
    /** « Déprogrammer » dans la fiche : lit les inscriptions retirées, puis écrit sans elles. */
    const askUnschedule = async (verdict: UnscheduleVerdictDto) => {
      host.querySelector<HTMLButtonElement>('#game-p1')!.click();
      await settle();
      button('Déprogrammer').focus();
      button('Déprogrammer').click();
      await fixture.whenStable();
      http.expectOne(apiUrl(scheduleEndpoints.unscheduleVerdict, { gameId: 'p1' })).flush(verdict);
      await settle();
    };
    const unschedule = async () => {
      await askUnschedule({ removedSignUps: [] });
      return http.expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }));
    };
    const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
    const dialogButton = (name: string) =>
      [...(dialog()?.querySelectorAll('button') ?? [])].find((b) => text(b) === name)!;
    /** Lâche la partie sur une case de la frise, avec les inscriptions que son verdict dit retirées. */
    const drop = async (target: Drop['target'], removedSignUps: Drop['removedSignUps'] = []) => {
      const timeline = fixture.debugElement.query(By.directive(ScheduleTimeline));
      (timeline.componentInstance as ScheduleTimeline).dropped.emit({
        subject: { kind: 'game', game: GAME },
        target,
        removedSignUps,
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
    return {
      http,
      host,
      settle,
      sheet,
      button,
      askUnschedule,
      unschedule,
      dialog,
      dialogButton,
      text,
      drop,
      gameAt,
    };
  }

  it('ouvre la fiche de la partie sans section « Inscrits » : le Calendrier ne lit pas le suivi', async () => {
    const { host, settle, sheet, button } = await render();

    host.querySelector<HTMLButtonElement>('#game-p1')!.click();
    await settle();

    expect(button('Déprogrammer')).toBeDefined();
    expect(sheet()?.querySelector('.sign-ups')).toBeNull();
  });

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

  it('refusé parce que la partie n’existe plus : alerte, puis la convention et le programme se relisent', async () => {
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

    expect(TestBed.inject(Alerts).notices()).toEqual([
      expect.objectContaining({ title: 'Partie introuvable', detail: problem.detail }),
    ]);
    http.expectOne(apiUrl(conventionEndpoints.read)).flush(CONVENTION);
    http.expectOne(apiUrl(scheduleEndpoints.read)).flush(UNSCHEDULED);
    await settle();
    expect(sheet()).toBeNull();
  });

  it('après une coupure : alerte, la fiche reste ouverte, sans relecture', async () => {
    const { http, settle, sheet, unschedule } = await render();

    (await unschedule()).error(new ProgressEvent('error'), { status: 0 });
    await settle();

    expect(sheet()).not.toBeNull();
    expect(TestBed.inject(Alerts).notices()).toEqual([
      expect.objectContaining({ title: `Pas de connexion${NBSP}: rien n'a été enregistré.` }),
    ]);
    http.verify();
  });

  describe('« Déprogrammer » une partie qui a des inscrits (IN-6, NO-2)', () => {
    const TWELVE: UnscheduleVerdictDto = {
      removedSignUps: [{ gameId: 'p1', signUpCount: 12, withoutOtherSignUpCount: 3 }],
    };

    it('demande d’abord une confirmation, qui dit combien d’inscrits perdent leur inscription', async () => {
      const { http, settle, sheet, askUnschedule, dialog, dialogButton, text } = await render();

      await askUnschedule(TWELVE);

      expect([...dialog()!.querySelectorAll('h2, p')].map(text)).toEqual([
        `Déprogrammer «${NBSP}Brumes${NBSP}» du créneau 1${THIN_NBSP}?`,
        `Il y a 12${NBSP}inscrits à la partie. Ils perdront leur inscription et seront notifiés.`,
        "3 d'entre eux n'ont pas d'autre inscription sur le créneau\u00a0: ils restent dans le tirage du créneau, mais sans être inscrits à aucune partie.",
        'Le scénario revient en réserve, sans ses inscriptions.',
      ]);
      expect(document.activeElement).toBe(dialogButton('Annuler'));
      http.expectNone(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }));

      dialogButton('Déprogrammer la partie').click();
      http.expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' })).flush(UNSCHEDULED);
      await settle();

      expect(dialog()).toBeNull();
      expect(sheet()).toBeNull();
    });

    it('au singulier, pour un inscrit dont c’est la seule inscription', async () => {
      const { askUnschedule, dialog, text } = await render();

      await askUnschedule({
        removedSignUps: [{ gameId: 'p1', signUpCount: 1, withoutOtherSignUpCount: 1 }],
      });

      expect([...dialog()!.querySelectorAll('p')].map(text)).toEqual([
        `Il y a 1${NBSP}inscrit à la partie. Il perdra son inscription et sera notifié.`,
        "C'est sa seule inscription sur le créneau\u00a0: il reste dans le tirage du créneau, mais sans être inscrit à aucune partie.",
        'Le scénario revient en réserve, sans ses inscriptions.',
      ]);
    });

    it('désigne une partie double par ses deux créneaux', async () => {
      const { askUnschedule, dialog, text } = await render(
        {
          ...CONVENTION,
          timeSlots: [
            ...CONVENTION.timeSlots,
            { id: 's2', rank: 2, start: '14:00', end: '16:30', availabilityCount: 1 },
          ],
        },
        { games: [{ ...GAME, timeSlotIds: ['s1', 's2'] }], reserve: [] },
      );

      await askUnschedule(TWELVE);

      expect(text(dialog()!.querySelector('h2'))).toBe(
        `Déprogrammer «${NBSP}Brumes${NBSP}» des créneaux 1 et 2${THIN_NBSP}?`,
      );
      expect(text(dialog()!.querySelector('p'))).toBe(
        `Il y a 12${NBSP}inscrits à la partie (créneaux 1 et 2). Ils perdront leur inscription et seront notifiés.`,
      );
    });

    it('sans inscrit, déprogramme aussitôt, sans dialogue', async () => {
      const { unschedule, dialog } = await render();

      (await unschedule()).flush(UNSCHEDULED);

      expect(dialog()).toBeNull();
    });

    it('« Annuler » n’écrit rien, et rend le focus à « Déprogrammer »', async () => {
      const { http, settle, sheet, button, askUnschedule, dialog, dialogButton } = await render();

      await askUnschedule(TWELVE);
      dialogButton('Annuler').click();
      await settle();

      expect(dialog()).toBeNull();
      expect(sheet()).not.toBeNull();
      expect(document.activeElement).toBe(button('Déprogrammer'));
      http.verify();
    });

    it('un geste périmé est refusé dans le dialogue, puis la convention et le programme se relisent', async () => {
      const { http, settle, askUnschedule, dialog, dialogButton } = await render();
      const problem: Partial<ProblemDto> = {
        status: 404,
        code: 'game-not-found',
        title: 'Partie introuvable',
        detail: "Cette partie n'existe plus : recharge la page.",
      };

      await askUnschedule(TWELVE);
      dialogButton('Déprogrammer la partie').click();
      http
        .expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }))
        .flush(problem, { status: 404, statusText: 'Introuvable' });
      await settle();

      expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain(problem.detail);
      expect(TestBed.inject(Alerts).notices()).toEqual([]);
      dialogButton('Fermer').click();
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      http.expectOne(apiUrl(conventionEndpoints.read)).flush(CONVENTION);
      http.expectOne(apiUrl(scheduleEndpoints.read)).flush(UNSCHEDULED);
      await settle();
      http.verify();
    });
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

    it('refusée (422) : la partie revient à sa place, alerte, puis la convention et le programme se relisent', async () => {
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
      expect(TestBed.inject(Alerts).notices()).toEqual([
        expect.objectContaining({ title: 'Table prise', detail: problem.detail }),
      ]);
      http.expectOne(apiUrl(conventionEndpoints.read)).flush(CONVENTION);
      http.expectOne(apiUrl(scheduleEndpoints.read)).flush(SCHEDULED);
      await settle();
      http.verify();
    });

    it('en conflit (409) : alerte « l’écran est à jour », puis la convention et le programme se relisent', async () => {
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
      expect(TestBed.inject(Alerts).notices()).toEqual([
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

    describe('un dépôt qui retire des inscriptions (IN-6, NO-2)', () => {
      const TWO_SLOTS: ConventionDto = {
        ...CONVENTION,
        timeSlots: [
          ...CONVENTION.timeSlots,
          { id: 's2', rank: 2, start: '14:00', end: '16:30', availabilityCount: 1 },
        ],
      };
      const toSlot2 = { kind: 'cell', timeSlotId: 's2', tableId: 't1', gameId: null } as const;
      const TWELVE = [{ gameId: 'p1', signUpCount: 12, withoutOtherSignUpCount: 3 }];
      const MOVED_TO_SLOT2: ScheduleDto = {
        games: [{ ...GAME, timeSlotIds: ['s2'] }],
        reserve: [],
      };

      it('sur une case : confirmation avant toute écriture, la carte atténuée à sa nouvelle place', async () => {
        const { http, settle, drop, gameAt, dialog, dialogButton, text } = await render(TWO_SLOTS);

        await drop(toSlot2, TWELVE);
        await settle();

        expect(text(dialog()!.querySelector('h2'))).toBe(
          `Déplacer «${NBSP}Brumes${NBSP}» sur le créneau 2${THIN_NBSP}?`,
        );
        expect(gameAt('s1', 't1')).toBeNull();
        expect(gameAt('s2', 't1')).toEqual({ title: 'Brumes', pending: true });
        http.expectNone(apiUrl(scheduleEndpoints.move, { gameId: 'p1' }));

        dialogButton('Déplacer la partie').click();
        const request = http.expectOne(apiUrl(scheduleEndpoints.move, { gameId: 'p1' }));
        expect(request.request.body).toEqual({ timeSlotId: 's2', tableId: 't1' });
        request.flush(MOVED_TO_SLOT2);
        await settle();

        expect(dialog()).toBeNull();
        expect(gameAt('s2', 't1')).toEqual({ title: 'Brumes', pending: false });
        expect(document.activeElement?.id).toBe('game-p1');
      });

      it('sur une autre partie : confirmation de l’échange, les deux cartes atténuées à leur nouvelle place', async () => {
        const OTHER: GameDto = {
          ...GAME,
          id: 'p2',
          timeSlotIds: ['s2'],
          scenario: { ...GAME.scenario, id: 'b', title: 'Néons' },
        };
        const { http, settle, drop, gameAt, dialog, dialogButton, text } = await render(TWO_SLOTS, {
          games: [GAME, OTHER],
          reserve: [],
        });

        await drop({ kind: 'cell', timeSlotId: 's2', tableId: 't1', gameId: 'p2' }, [
          ...TWELVE,
          { gameId: 'p2', signUpCount: 4, withoutOtherSignUpCount: 0 },
        ]);
        await settle();

        expect([...dialog()!.querySelectorAll('h2, p')].map(text)).toEqual([
          `Échanger «${NBSP}Brumes${NBSP}» et «${NBSP}Néons${NBSP}»${THIN_NBSP}?`,
          `Il y a 12${NBSP}inscrits à «${NBSP}Brumes${NBSP}» (créneau 1). Ils perdront leur inscription et seront notifiés.`,
          "3 d'entre eux n'ont pas d'autre inscription sur le créneau\u00a0: ils restent dans le tirage du créneau, mais sans être inscrits à aucune partie.",
          `Il y a 4${NBSP}inscrits à «${NBSP}Néons${NBSP}» (créneau 2). Ils perdront leur inscription et seront notifiés.`,
        ]);
        expect(gameAt('s2', 't1')).toEqual({ title: 'Brumes', pending: true });
        expect(gameAt('s1', 't1')).toEqual({ title: 'Néons', pending: true });
        http.expectNone(apiUrl(scheduleEndpoints.swap, { gameId: 'p1' }));

        dialogButton('Échanger les parties').click();
        const request = http.expectOne(apiUrl(scheduleEndpoints.swap, { gameId: 'p1' }));
        expect(request.request.body).toEqual({ otherGameId: 'p2' });
      });

      it('« Annuler » ramène la carte à sa place, sans rien écrire', async () => {
        const { http, settle, drop, gameAt, dialogButton } = await render(TWO_SLOTS);

        await drop(toSlot2, TWELVE);
        await settle();
        dialogButton('Annuler').click();
        await settle();

        expect(gameAt('s1', 't1')).toEqual({ title: 'Brumes', pending: false });
        expect(gameAt('s2', 't1')).toBeNull();
        http.verify();
      });

      it('sur le bac : lit les chiffres de la déprogrammation, puis confirme', async () => {
        const { http, settle, drop, dialog, dialogButton, text } = await render();

        await drop({ kind: 'reserve' });
        http
          .expectOne(apiUrl(scheduleEndpoints.unscheduleVerdict, { gameId: 'p1' }))
          .flush({ removedSignUps: TWELVE });
        await settle();

        expect(text(dialog()!.querySelector('h2'))).toBe(
          `Déprogrammer «${NBSP}Brumes${NBSP}» du créneau 1${THIN_NBSP}?`,
        );
        http.expectNone(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }));
        dialogButton('Déprogrammer la partie').click();
        http.expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' })).flush(UNSCHEDULED);
        await settle();

        expect(dialog()).toBeNull();
        expect(document.activeElement?.id).toBe('reserve-title');
      });

      it('sur le bac, sans inscrit : déprogramme aussitôt, sans dialogue', async () => {
        const { http, settle, drop, dialog } = await render();

        await drop({ kind: 'reserve' });
        http
          .expectOne(apiUrl(scheduleEndpoints.unscheduleVerdict, { gameId: 'p1' }))
          .flush({ removedSignUps: [] });
        await settle();

        expect(dialog()).toBeNull();
        http.expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' })).flush(UNSCHEDULED);
        await settle();
        http.verify();
      });
    });
  });
});
