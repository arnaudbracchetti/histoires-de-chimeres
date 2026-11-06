import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  apiUrl,
  scheduleEndpoints,
  type GameDto,
  type MovePlacementDto,
  type PlacementDto,
  type ProblemDto,
  type RemovedSignUpsDto,
  type ScheduleDto,
  type ScheduleScenarioDto,
  type TableDto,
  type TimeSlotDto,
} from '@chimeres/contract';
import { NBSP, THIN_NBSP } from '@chimeres/design';
import { Placements, type MoveRequest } from './placement-dialog';

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
].map((verdict) => ({ ...verdict, erasedDrawTimeSlotId: null }));

/** La confirmation ouverte : son titre, puis ses paragraphes. */
const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const confirmationTexts = () =>
  [...confirmation()!.querySelectorAll('h2, p')].map((element) => element.textContent?.trim());
const confirmationButton = (name: string) =>
  [...confirmation()!.querySelectorAll('button')].find(
    (button) => button.textContent?.trim() === name,
  )!;
const ERASED_DRAW_OF_SLOT_1 = `Le tirage provisoire du créneau 1 sera effacé, avec ses déplacements et ses parties annulées. Les inscriptions sur ce créneau seront rouvertes.`;

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

    expect(text(dialog().querySelector('h2'))).toBe(`Programmer «${NBSP}Brumes${NBSP}» sur…`);
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

  it('sur un créneau en tirage, demande d’abord une confirmation rouge : le tirage sera effacé (TI-6)', async () => {
    const { http, closed, dialog, flushPlacements } = await open();
    await flushPlacements(
      PLACEMENTS.map((verdict) =>
        verdict.refusal ? verdict : { ...verdict, erasedDrawTimeSlotId: 's1' },
      ),
    );

    dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!.click();
    await settle();

    expect(confirmationTexts()).toEqual([
      `Programmer «${NBSP}Brumes${NBSP}» sur le créneau 1, Table 2${THIN_NBSP}?`,
      ERASED_DRAW_OF_SLOT_1,
    ]);
    expect(confirmation()!.querySelector('button.danger')).toBeTruthy();
    http.expectNone(apiUrl(scheduleEndpoints.schedule));
    confirmationButton('Programmer la partie').click();
    http.expectOne(apiUrl(scheduleEndpoints.schedule)).flush(SCHEDULE);

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

  describe('« Déplacer vers… »', () => {
    const GAME: GameDto = {
      id: 'p1',
      tableId: 't2',
      timeSlotIds: ['s1'],
      seats: { min: 3, max: 5 },
      scenario: SCENARIO,
    };

    /** La partie de Brann sur le créneau 2, table 1. */
    const OTHER: GameDto = {
      id: 'p2',
      tableId: 't1',
      timeSlotIds: ['s2'],
      seats: { min: 3, max: 5 },
      scenario: {
        ...SCENARIO,
        id: 'b',
        title: 'Néons',
        gameMaster: { id: 'g1', nickname: 'Brann' },
      },
    };

    /** Les verdicts de PLACEMENTS : un déplacement sur chaque case. */
    const MOVE_PLACEMENTS: MovePlacementDto[] = PLACEMENTS.map((verdict) => ({
      ...verdict,
      swapWith: null,
      removedSignUps: [],
    }));

    async function openMove(
      placements = MOVE_PLACEMENTS,
      currentSignUpFigures?: MoveRequest['currentSignUpFigures'],
    ) {
      const http = TestBed.inject(HttpTestingController);
      const closed = TestBed.inject(Placements).moveTo({
        game: GAME,
        games: [GAME, OTHER],
        timeSlots: TIME_SLOTS,
        tables: TABLES,
        currentSignUpFigures,
      });
      await settle();
      http.expectOne(apiUrl(scheduleEndpoints.movePlacements, { gameId: 'p1' })).flush(placements);
      await settle();
      return { http, closed, dialog: () => document.querySelector('app-placement-dialog')! };
    }

    it('lit les verdicts de la partie, et marque sa place', async () => {
      const { dialog } = await openMove();

      expect(dialog().querySelector('h2')?.textContent).toBe(
        `Déplacer «${NBSP}Brumes${NBSP}» vers…`,
      );
      const cell = dialog().querySelectorAll('tbody tr')[1]!.querySelectorAll('td')[0]!;
      expect(cell.textContent?.trim()).toBe('Sa place');
      expect(dialog().querySelectorAll('button[aria-label^="Choisir"]')).toHaveLength(0);
    });

    it('déplace la partie sur la case choisie, et se ferme sur le programme relu', async () => {
      const { http, closed, dialog } = await openMove(
        MOVE_PLACEMENTS.map((verdict) =>
          verdict.timeSlotId === 's2' && verdict.tableId === 't1'
            ? { ...verdict, refusal: null }
            : verdict,
        ),
      );

      dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!.click();
      const request = http.expectOne(apiUrl(scheduleEndpoints.move, { gameId: 'p1' }));
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ timeSlotId: 's2', tableId: 't1' });
      request.flush(SCHEDULE);

      expect(await closed).toEqual({ schedule: SCHEDULE, swappedWith: null });
    });

    it("propose « Échanger » sur la case d'une autre partie, et l'éteint avec le motif de son refus", async () => {
      const { dialog } = await openMove(
        MOVE_PLACEMENTS.map((verdict) =>
          verdict.timeSlotId === 's1' && verdict.tableId === 't1'
            ? { ...verdict, swapWith: 'p2', refusal: null }
            : verdict.timeSlotId === 's2' && verdict.tableId === 't2'
              ? { ...verdict, swapWith: 'p3' }
              : verdict,
        ),
      );

      const swap = dialog().querySelector<HTMLButtonElement>('button[aria-label^="Échanger"]')!;
      expect(swap.textContent?.trim()).toBe('Échanger');
      expect(swap.getAttribute('aria-label')).toBe(
        'Échanger Créneau 1 · 9\u00a0h\u00a000\u202f–\u202f11\u00a0h\u00a030, Table 1',
      );
      expect(document.activeElement).toBe(swap);
      expect(dialog().querySelectorAll('button[aria-label^="Échanger"]')).toHaveLength(1);
      const refusedSwap = dialog().querySelectorAll('tbody tr')[1]!.querySelectorAll('td')[1]!;
      expect(refusedSwap.querySelector('.off')?.getAttribute('title')).toBe(
        'Kaïros mène déjà une partie sur le créneau 2.',
      );
    });

    it('échange les deux parties, et se ferme sur le programme relu', async () => {
      const { http, closed, dialog } = await openMove(
        MOVE_PLACEMENTS.map((verdict) =>
          verdict.timeSlotId === 's1' && verdict.tableId === 't1'
            ? { ...verdict, swapWith: 'p2', refusal: null }
            : verdict,
        ),
      );

      dialog().querySelector<HTMLButtonElement>('button[aria-label^="Échanger"]')!.click();
      const request = http.expectOne(apiUrl(scheduleEndpoints.swap, { gameId: 'p1' }));
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ otherGameId: 'p2' });
      request.flush(SCHEDULE);

      expect(await closed).toEqual({ schedule: SCHEDULE, swappedWith: 'p2' });
    });

    describe('un geste qui retire des inscriptions (IN-6, NO-2)', () => {
      /** Le créneau 2, table 1 permis : un déplacement qui retire 12 inscriptions. */
      const toSlot2 = MOVE_PLACEMENTS.map((verdict) =>
        verdict.timeSlotId === 's2' && verdict.tableId === 't1'
          ? {
              ...verdict,
              refusal: null,
              removedSignUps: [{ gameId: 'p1', signUpCount: 12, withoutOtherSignUpCount: 3 }],
            }
          : verdict,
      );

      it('« Choisir » demande d’abord une confirmation, sans rien dire sur la case', async () => {
        const { http, closed, dialog } = await openMove(toSlot2);
        const choose = dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!;
        expect(choose.textContent?.trim()).toBe('Choisir');

        choose.click();
        await settle();

        expect(confirmationTexts()).toEqual([
          `Déplacer «${NBSP}Brumes${NBSP}» sur le créneau 2${THIN_NBSP}?`,
          `Il y a 12${NBSP}inscrits à la partie. Ils perdront leur inscription et seront notifiés.`,
          "3 d'entre eux n'ont pas d'autre inscription sur le créneau\u00a0: ils restent dans le tirage du créneau, mais sans être inscrits à aucune partie.",
        ]);
        expect(document.activeElement).toBe(confirmationButton('Annuler'));
        http.expectNone(apiUrl(scheduleEndpoints.move, { gameId: 'p1' }));

        confirmationButton('Déplacer la partie').click();
        http.expectOne(apiUrl(scheduleEndpoints.move, { gameId: 'p1' })).flush(SCHEDULE);

        expect(await closed).toEqual({ schedule: SCHEDULE, swappedWith: null });
      });

      it('ajoute le tirage provisoire effacé aux inscriptions retirées (TI-6)', async () => {
        const { dialog } = await openMove(
          toSlot2.map((verdict) =>
            verdict.refusal ? verdict : { ...verdict, erasedDrawTimeSlotId: 's1' },
          ),
        );

        dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!.click();
        await settle();

        expect(confirmationTexts().slice(1)).toEqual([
          `Il y a 12${NBSP}inscrits à la partie. Ils perdront leur inscription et seront notifiés.`,
          "3 d'entre eux n'ont pas d'autre inscription sur le créneau\u00a0: ils restent dans le tirage du créneau, mais sans être inscrits à aucune partie.",
          ERASED_DRAW_OF_SLOT_1,
        ]);
      });

      it('confirme un tirage effacé, même sans inscription retirée (TI-6)', async () => {
        const { dialog } = await openMove(
          MOVE_PLACEMENTS.map((verdict) =>
            verdict.timeSlotId === 's2' && verdict.tableId === 't1'
              ? { ...verdict, refusal: null, erasedDrawTimeSlotId: 's1' }
              : verdict,
          ),
        );

        dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!.click();
        await settle();

        expect(confirmationTexts()).toEqual([
          `Déplacer «${NBSP}Brumes${NBSP}» sur le créneau 2${THIN_NBSP}?`,
          ERASED_DRAW_OF_SLOT_1,
        ]);
      });

      it('« Annuler » n’écrit rien, et rend le focus à « Choisir »', async () => {
        const { http, dialog } = await openMove(toSlot2);
        const choose = dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!;
        choose.focus();
        choose.click();
        await settle();

        confirmationButton('Annuler').click();
        await settle();

        expect(confirmation()).toBeNull();
        expect(document.activeElement).toBe(choose);
        http.verify();
      });

      it('un refus s’affiche dans la confirmation, puis la grille se relit', async () => {
        const { http, dialog } = await openMove(toSlot2);
        dialog().querySelector<HTMLButtonElement>('button[aria-label^="Choisir"]')!.click();
        await settle();
        const detail = "Cette partie n'existe plus\u00a0: recharge la page.";

        confirmationButton('Déplacer la partie').click();
        http
          .expectOne(apiUrl(scheduleEndpoints.move, { gameId: 'p1' }))
          .flush(
            { status: 404, code: 'game-not-found', title: 'Partie introuvable', detail },
            { status: 404, statusText: 'Introuvable' },
          );
        await settle();

        expect(confirmation()!.querySelector('[role="alert"]')?.textContent).toBe(detail);
        confirmationButton('Fermer').click();
        await settle();
        http.expectOne(apiUrl(scheduleEndpoints.movePlacements, { gameId: 'p1' }));
      });

      it('« Échanger » donne une ligne par partie qui perd ses inscriptions', async () => {
        const { http, closed, dialog } = await openMove(
          MOVE_PLACEMENTS.map((verdict) =>
            verdict.timeSlotId === 's2' && verdict.tableId === 't1'
              ? {
                  ...verdict,
                  swapWith: 'p2',
                  refusal: null,
                  removedSignUps: [
                    { gameId: 'p1', signUpCount: 1, withoutOtherSignUpCount: 0 },
                    { gameId: 'p2', signUpCount: 4, withoutOtherSignUpCount: 1 },
                  ],
                }
              : verdict,
          ),
        );

        dialog().querySelector<HTMLButtonElement>('button[aria-label^="Échanger"]')!.click();
        await settle();

        expect(confirmationTexts()).toEqual([
          `Échanger «${NBSP}Brumes${NBSP}» et «${NBSP}Néons${NBSP}»${THIN_NBSP}?`,
          `Il y a 1${NBSP}inscrit à «${NBSP}Brumes${NBSP}» (créneau 1). Il perdra son inscription et sera notifié.`,
          `Il y a 4${NBSP}inscrits à «${NBSP}Néons${NBSP}» (créneau 2). Ils perdront leur inscription et seront notifiés.`,
          "1 d'entre eux n'a pas d'autre inscription sur le créneau\u00a0: il reste dans le tirage du créneau, mais sans être inscrit à aucune partie.",
        ]);
        confirmationButton('Échanger les parties').click();
        http.expectOne(apiUrl(scheduleEndpoints.swap, { gameId: 'p1' })).flush(SCHEDULE);

        expect(await closed).toEqual({ schedule: SCHEDULE, swappedWith: 'p2' });
      });

      it('suit les chiffres à jour de chaque partie tant que la confirmation est ouverte', async () => {
        const current = signal<Record<string, RemovedSignUpsDto>>({});
        const { dialog } = await openMove(
          MOVE_PLACEMENTS.map((verdict) =>
            verdict.timeSlotId === 's2' && verdict.tableId === 't1'
              ? {
                  ...verdict,
                  swapWith: 'p2',
                  refusal: null,
                  removedSignUps: [
                    { gameId: 'p1', signUpCount: 1, withoutOtherSignUpCount: 0 },
                    { gameId: 'p2', signUpCount: 4, withoutOtherSignUpCount: 1 },
                  ],
                }
              : verdict,
          ),
          (gameId) => current()[gameId],
        );
        dialog().querySelector<HTMLButtonElement>('button[aria-label^="Échanger"]')!.click();
        await settle();

        current.set({
          p1: { gameId: 'p1', signUpCount: 0, withoutOtherSignUpCount: 0 },
          p2: { gameId: 'p2', signUpCount: 2, withoutOtherSignUpCount: 0 },
        });
        await settle();

        expect(confirmationTexts()).toEqual([
          `Échanger «${NBSP}Brumes${NBSP}» et «${NBSP}Néons${NBSP}»${THIN_NBSP}?`,
          `Aucun inscrit de «${NBSP}Brumes${NBSP}» (créneau 1) ne perd son inscription.`,
          `Il y a 2${NBSP}inscrits à «${NBSP}Néons${NBSP}» (créneau 2). Ils perdront leur inscription et seront notifiés.`,
        ]);
      });
    });
  });
});
