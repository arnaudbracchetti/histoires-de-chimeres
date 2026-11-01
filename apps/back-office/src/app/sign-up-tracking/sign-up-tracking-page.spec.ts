import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  apiUrl,
  scheduleEndpoints,
  signUpTrackingEndpoints,
  type ProblemDto,
  type RemovedSignUpsDto,
  type ScheduleDto,
  type SignUpTrackingDto,
  type TimeSlotTrackingDto,
  type TrackedGameDto,
} from '@chimeres/contract';
import { NBSP, THIN_NBSP } from '@chimeres/design';
import { Placements, type MoveRequest, type Placed } from '../schedule/placement-dialog';
import { Alerts } from '../shell/alerts';
import { Announcer } from '../shell/announcer';
import { SignUpTrackingPage } from './sign-up-tracking-page';

const timeSlot = (
  rank: number,
  start: string,
  end: string,
  figures: Partial<TimeSlotTrackingDto> = {},
): TimeSlotTrackingDto => ({
  id: `s${rank}`,
  rank,
  start,
  end,
  state: 'sign-ups-open',
  demand: 0,
  capacity: { min: 0, max: 0 },
  ...figures,
});

const game = (
  id: string,
  title: string,
  tableId: string,
  timeSlotIds: string[],
  figures: Partial<TrackedGameDto> = {},
): TrackedGameDto => ({
  id,
  tableId,
  timeSlotIds,
  seats: { min: 3, max: 4 },
  scenario: {
    id: `scenario-${id}`,
    title,
    system: 'Cthulhu',
    seats: { min: 3, max: 4 },
    duration: timeSlotIds.length as 1 | 2,
    imageUrl: null,
    gameMaster: { id: `g-${id}`, nickname: 'Kaïros' },
  },
  signUpCount: 0,
  withoutOtherSignUpCount: 0,
  oversubscribed: false,
  belowMinimum: false,
  surplusSignUpCount: 0,
  missingSignUpCount: 0,
  ...figures,
});

/** Au créneau 2 : « Brumes » (Dragon), très demandée ; « Néons » (Sphinx), double, sous son minimum. */
const BRUMES = game('p1', 'Brumes', 't1', ['s2'], {
  signUpCount: 15,
  withoutOtherSignUpCount: 8,
  oversubscribed: true,
  surplusSignUpCount: 11,
});
const NEONS = game('p3', 'Néons', 't4', ['s2', 's3'], {
  signUpCount: 2,
  belowMinimum: true,
  missingSignUpCount: 1,
});
/** « Épice » (Licorne), double, des créneaux 1 et 2. */
const EPICE = game('p2', 'Épice', 't2', ['s1', 's2'], { signUpCount: 6 });

/**
 * Créneau 1 publié ; créneau 2 ouvert, très demandé ; créneau 3 ouvert, sans inscription. Tables
 * Dragon, Licorne, Phénix et Sphinx.
 */
const TRACKING: SignUpTrackingDto = {
  timeSlots: [
    timeSlot(1, '09:00', '11:30', {
      state: 'published',
      demand: 18,
      capacity: { min: 12, max: 20 },
    }),
    timeSlot(2, '13:00', '15:30', { demand: 26, capacity: { min: 14, max: 22 } }),
    timeSlot(3, '16:00', '18:30', { capacity: { min: 4, max: 4 } }),
  ],
  tables: [
    { id: 't1', name: 'Dragon' },
    { id: 't2', name: 'Licorne' },
    { id: 't3', name: 'Phénix' },
    { id: 't4', name: 'Sphinx' },
  ],
  games: [BRUMES, EPICE, NEONS],
};

/** Le texte, un blanc entre deux nœuds, espaces normalisées : pour comparer sans les insécables. */
const text = (element: Element | null | undefined) => {
  const parts: string[] = [];
  if (element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? '');
  }
  return parts
    .join(' ')
    .replaceAll(NBSP, ' ')
    .replaceAll(THIN_NBSP, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

describe('Pilotage du jour J', () => {
  /** Le dialogue de placement, qui a sa propre spec : il rend ce que le test lui fait rendre. */
  let moveTo: ReturnType<typeof vi.fn<(request: MoveRequest) => Promise<Placed | undefined>>>;

  beforeEach(() => {
    moveTo = vi.fn<(request: MoveRequest) => Promise<Placed | undefined>>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Placements, useValue: { moveTo } },
      ],
    });
  });

  afterEach(() => {
    document.querySelectorAll('.cdk-overlay-container').forEach((overlay) => overlay.remove());
  });

  async function render(tracking = TRACKING) {
    const fixture = TestBed.createComponent(SignUpTrackingPage);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(apiUrl(signUpTrackingEndpoints.read)).flush(tracking);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    const tiles = () => [...host.querySelectorAll<HTMLButtonElement>('.strip button')];
    const summary = () => host.querySelector('.summary');
    const tabs = () => [...host.querySelectorAll<HTMLElement>('[role="tab"]')];
    const panel = () => host.querySelector<HTMLElement>('[role="tabpanel"]:not([inert])');
    const rows = () => [...(panel()?.querySelectorAll('li') ?? [])];
    const sheet = () => host.querySelector('app-game-sheet');
    const button = (name: string) =>
      [...host.querySelectorAll('button')].find((candidate) => text(candidate) === name);
    /**
     * La relecture du suivi, servie avec `next`, après le geste qui l'a lancée. Pas de `whenStable()`
     * avant de l'avoir servie : elle garde l'application instable.
     */
    const reread = async (next: SignUpTrackingDto) => {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      http.expectOne(apiUrl(signUpTrackingEndpoints.read)).flush(next);
      await settle();
    };
    /** « Déprogrammer » dans la fiche de « Brumes » : lit les inscriptions que le geste retirerait. */
    const askUnschedule = async (removedSignUps: RemovedSignUpsDto[] = []) => {
      host.querySelector<HTMLButtonElement>('#tracked-game-p1')!.click();
      await settle();
      button('Déprogrammer')!.click();
      await fixture.whenStable();
      http
        .expectOne(apiUrl(scheduleEndpoints.unscheduleVerdict, { gameId: 'p1' }))
        .flush({ removedSignUps });
      await settle();
    };
    const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
    return {
      fixture,
      http,
      askUnschedule,
      dialog,
      host,
      settle,
      tiles,
      summary,
      tabs,
      panel,
      rows,
      sheet,
      button,
      reread,
    };
  }

  it('titre la page, avec la ligne réservée à l’âge des chiffres, vide', async () => {
    const { host } = await render();

    expect(text(host.querySelector('h1'))).toBe('Pilotage du jour J');
    expect(text(host.querySelector('.freshness'))).toBe('');
  });

  it('montre une tuile par créneau, avec rang, plage, ratio et légende', async () => {
    const { tiles } = await render();

    expect(tiles()).toHaveLength(3);
    expect(text(tiles()[1])).toBe('Créneau 2 13 h 00 – 15 h 30 26 / 22 participants / places');
  });

  it('montre chaque participant d’un créneau par une case de sa jauge', async () => {
    const { tiles } = await render();

    // Créneau 2 : 26 participants pour 14 à 22 places.
    expect(tiles()[1]!.querySelectorAll('app-gauge .cell')).toHaveLength(26);
    expect(tiles()[1]!.querySelectorAll('app-gauge .cell.over')).toHaveLength(4);
  });

  it('choisit à l’ouverture le premier créneau dont les inscriptions sont ouvertes', async () => {
    const { tiles, summary } = await render();

    expect(tiles().map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(text(summary()?.querySelector('h2'))).toBe('Créneau 2 · 13 h 00 – 15 h 30');
  });

  it('atténue la tuile d’un créneau fermé, avec son état et sans chiffres', async () => {
    const { tiles } = await render({
      ...TRACKING,
      timeSlots: [
        ...TRACKING.timeSlots,
        timeSlot(4, '19:00', '21:30', {
          state: 'drawing',
          demand: 3,
          capacity: { min: 3, max: 5 },
        }),
      ],
    });

    expect(tiles()[0]!.classList).toContain('closed');
    expect(text(tiles()[0])).toBe('Créneau 1 9 h 00 – 11 h 30 Tirage publié');
    expect(text(tiles()[3])).toBe('Créneau 4 19 h 00 – 21 h 30 Tirage en cours');
  });

  it('résume la demande et la capacité du créneau choisi', async () => {
    const { summary } = await render();

    expect(text(summary()?.querySelector('.figures'))).toBe('26 participants 14 à 22 places');
    // Le nombre et son nom ne se séparent pas en fin de ligne.
    expect(summary()?.querySelector('.figures')?.textContent).toContain(`26${NBSP}participants`);
  });

  it('écrit une seule borne quand les deux sont égales, et le texte sans inscription', async () => {
    const { fixture, tiles, summary } = await render();

    tiles()[2]!.click();
    fixture.detectChanges();

    expect(tiles()[2]!.getAttribute('aria-pressed')).toBe('true');
    expect(text(summary()?.querySelector('.figures'))).toBe('0 participant 4 places');
    expect(text(summary())).toContain("Aucune inscription sur ce créneau pour l'instant.");
  });

  it('dit qu’un créneau publié ne change plus', async () => {
    const { fixture, tiles, summary } = await render();

    tiles()[0]!.click();
    fixture.detectChanges();

    expect(text(summary())).toBe(
      'Créneau 1 · 9 h 00 – 11 h 30 Tirage publié : les inscriptions sont fermées et le programme du créneau ne change plus.',
    );
  });

  describe('onglets', () => {
    it('montre l’onglet « Parties du créneau », choisi, avec son icône et son compteur', async () => {
      const { tabs, panel } = await render();

      expect(tabs().map(text)).toEqual(['Parties du créneau 2']);
      expect(tabs()[0]!.querySelector('app-icon')?.getAttribute('name')).toBe('dices');
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(panel()).not.toBeNull();
    });

    it('garde l’onglet choisi au clavier, avec ← →, Début et Fin', async () => {
      const { fixture, tabs } = await render();
      const tab = tabs()[0]!;
      tab.focus();

      for (const key of ['ArrowRight', 'ArrowLeft', 'End', 'Home']) {
        tab.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        fixture.detectChanges();
        expect(document.activeElement).toBe(tab);
        expect(tab.getAttribute('aria-selected')).toBe('true');
      }
    });

    it('garde l’onglet ouvert d’un créneau à l’autre, avec le compteur du créneau', async () => {
      const { fixture, tiles, tabs, rows } = await render();

      tiles()[2]!.click();
      fixture.detectChanges();

      expect(tabs().map(text)).toEqual(['Parties du créneau 0']);
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(rows().map(text)).toEqual([
        'Dragon Table libre',
        'Licorne Table libre',
        'Phénix Table libre',
        'Sphinx Partie double, comptée sur le créneau 2',
      ]);
    });

    it('n’a aucun onglet sur un créneau fermé', async () => {
      const { fixture, tiles, tabs } = await render();

      tiles()[0]!.click();
      fixture.detectChanges();

      expect(tabs()).toEqual([]);
    });
  });

  describe('onglet Parties du créneau', () => {
    it('compte les tables libres, puis une ligne par table dans l’ordre des tables', async () => {
      const { panel, rows } = await render();

      // « B » et « N » : la lettrine de la vignette.
      expect(text(panel()?.querySelector('.free-tables'))).toBe('1 table libre');
      expect(rows().map(text)).toEqual([
        'Dragon B Brumes Cthulhu · Kaïros 15 inscrits · 3 à 4 places · 11 de trop dont 8 sans autre inscription sur le créneau Très demandée',
        'Licorne Partie double, comptée sur le créneau 1',
        'Phénix Table libre',
        'Sphinx N Néons Cthulhu · Kaïros 2 inscrits · 3 à 4 places · 1 manquant double Sous son minimum',
      ]);
    });

    it('distingue la table libre et le second créneau d’une partie double', async () => {
      const { rows } = await render();

      expect(rows()[1]!.classList).toContain('second-slot');
      expect(rows()[2]!.classList).toContain('free');
    });

    it('montre chaque inscription d’une partie par une case de sa jauge', async () => {
      const { rows } = await render();
      const cells = (row: Element) => [...row.querySelectorAll('app-gauge .cell')];

      // « Brumes » : 15 inscrits pour 3 à 4 places, dont 11 de trop.
      expect(cells(rows()[0]!)).toHaveLength(15);
      expect(cells(rows()[0]!).filter((cell) => cell.matches('.over'))).toHaveLength(11);
      // « Néons » : 2 inscrits pour 3 à 4 places.
      expect(cells(rows()[3]!)).toHaveLength(4);
      expect(cells(rows()[3]!).filter((cell) => cell.matches('.filled'))).toHaveLength(2);
    });

    it('colore la jauge d’après les drapeaux reçus', async () => {
      const { rows } = await render();

      expect(rows()[0]!.querySelector('app-gauge')?.classList).not.toContain('shortfall');
      expect(rows()[0]!.querySelector('app-gauge')?.classList).not.toContain('danger');
      expect(rows()[3]!.querySelector('app-gauge')?.classList).toContain('shortfall');
      expect(rows()[3]!.querySelector('.badge.warning')).not.toBeNull();
    });
  });

  describe('fiche de la partie', () => {
    it('s’ouvre d’un clic sur le titre, et Échap la ferme en rendant le focus à la ligne', async () => {
      const { settle, sheet, host } = await render();
      const title = host.querySelector<HTMLButtonElement>('#tracked-game-p1')!;
      expect(title.getAttribute('aria-expanded')).toBe('false');

      title.click();
      await settle();

      expect(title.getAttribute('aria-expanded')).toBe('true');
      expect(text(sheet()?.querySelector('h2'))).toBe('Brumes');
      expect(document.activeElement).toBe(sheet()?.querySelector('h2'));

      sheet()!
        .querySelector('aside')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();

      expect(sheet()).toBeNull();
      expect(document.activeElement).toBe(host.querySelector('#tracked-game-p1'));
    });

    it('s’ouvre d’un clic n’importe où sur la ligne de la partie', async () => {
      const { settle, rows, sheet, host } = await render();

      rows()[0]!.querySelector<HTMLElement>('.figures')!.click();
      await settle();

      expect(text(sheet()?.querySelector('h2'))).toBe('Brumes');
      expect(host.querySelector('#tracked-game-p1')?.getAttribute('aria-expanded')).toBe('true');
    });

    it('ne s’ouvre pas d’un clic sur une table libre', async () => {
      const { settle, rows, sheet } = await render();

      (rows()[2] as HTMLElement).click();
      await settle();

      expect(sheet()).toBeNull();
    });

    it('« Déplacer vers… » : la page choisit le nouveau créneau, et met le focus sur sa ligne', async () => {
      const { settle, host, tiles, button, reread } = await render();
      const moved = { ...BRUMES, timeSlotIds: ['s3'] };
      moveTo.mockResolvedValue({
        schedule: { games: [moved, EPICE, NEONS], reserve: [] },
        swappedWith: null,
      });
      host.querySelector<HTMLButtonElement>('#tracked-game-p1')!.click();
      await settle();

      button('Déplacer vers…')!.click();
      await reread({ ...TRACKING, games: [moved, EPICE, NEONS] });

      expect(moveTo).toHaveBeenCalledWith(
        expect.objectContaining({ game: BRUMES, tables: TRACKING.tables }),
      );
      expect(tiles()[2]!.getAttribute('aria-pressed')).toBe('true');
      expect(document.activeElement?.id).toBe('tracked-game-p1');
      expect(TestBed.inject(Announcer).message()).toBe(
        `Partie déplacée${NBSP}: créneau 3, table Dragon.`,
      );
    });

    it('« Déprogrammer » : la fiche se ferme, le focus va au titre du résumé, et le suivi se relit', async () => {
      const { http, sheet, askUnschedule, reread } = await render();

      await askUnschedule();
      const unscheduled: ScheduleDto = { games: [EPICE, NEONS], reserve: [] };
      http.expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' })).flush(unscheduled);
      await reread({ ...TRACKING, games: [EPICE, NEONS] });

      expect(sheet()).toBeNull();
      expect(document.activeElement?.id).toBe('summary-title');
      expect(TestBed.inject(Announcer).message()).toBe(
        `Partie «${NBSP}Brumes${NBSP}» déprogrammée.`,
      );
    });

    it('« Déprogrammer » une partie qui a des inscrits : confirmation avant toute écriture', async () => {
      const { http, settle, dialog, askUnschedule, reread } = await render();

      await askUnschedule([{ gameId: 'p1', signUpCount: 15, withoutOtherSignUpCount: 8 }]);

      expect([...dialog()!.querySelectorAll('h2, p')].map(text)).toEqual([
        'Déprogrammer « Brumes » du créneau 2 ?',
        'Il y a 15 inscrits à la partie. Ils perdront leur inscription et seront notifiés.',
        "8 d'entre eux n'ont pas d'autre inscription sur le créneau.",
        'Le scénario revient en réserve, sans ses inscriptions.',
      ]);
      http.expectNone(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }));

      [...dialog()!.querySelectorAll('button')]
        .find((candidate) => text(candidate) === 'Déprogrammer la partie')!
        .click();
      http
        .expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }))
        .flush({ games: [EPICE, NEONS], reserve: [] });
      await reread({ ...TRACKING, games: [EPICE, NEONS] });
      await settle();

      expect(dialog()).toBeNull();
      expect(document.activeElement?.id).toBe('summary-title');
    });

    it('se ferme quand sa partie disparaît du programme à la relecture', async () => {
      const { http, sheet, askUnschedule, reread } = await render();
      const problem: Partial<ProblemDto> = {
        status: 404,
        code: 'game-not-found',
        title: 'Partie introuvable',
      };

      await askUnschedule();
      http
        .expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }))
        .flush(problem, { status: 404, statusText: 'Introuvable' });
      await reread({ ...TRACKING, games: [EPICE, NEONS] });

      expect(sheet()).toBeNull();
    });

    it('refus périmé : alerte, puis relecture ; un tirage lancé entre-temps retire les actions', async () => {
      const { http, sheet, button, askUnschedule, reread } = await render();
      const problem: Partial<ProblemDto> = {
        status: 409,
        code: 'concurrent-modification',
        title: 'La convention a changé entre-temps',
      };

      await askUnschedule();
      http
        .expectOne(apiUrl(scheduleEndpoints.unschedule, { gameId: 'p1' }))
        .flush(problem, { status: 409, statusText: 'Conflit' });
      await reread({
        ...TRACKING,
        timeSlots: TRACKING.timeSlots.map((slot) =>
          slot.id === 's2' ? { ...slot, state: 'drawing' } : slot,
        ),
      });
      expect(TestBed.inject(Alerts).notices()).toEqual([
        expect.objectContaining({ title: 'La convention a changé entre-temps' }),
      ]);
      expect(text(sheet()?.querySelector('h2'))).toBe('Brumes');
      expect(button('Déplacer vers…')).toBeUndefined();
      expect(button('Déprogrammer')).toBeUndefined();
    });
  });
});
