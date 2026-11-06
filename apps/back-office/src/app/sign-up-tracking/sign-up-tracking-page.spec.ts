import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  apiUrl,
  drawEndpoints,
  scheduleEndpoints,
  signUpTrackingEndpoints,
  type PlacementDto,
  type ProblemDto,
  type RemovedSignUpsDto,
  type ReserveScenarioDto,
  type ScheduleDto,
  type DrawTrackingDto,
  type DrawGameDto,
  type SignUpTrackingDto,
  type TimeSlotTrackingDto,
  type TrackedGameDto,
  type TrackedParticipantDto,
} from '@chimeres/contract';
import { NBSP, THIN_NBSP } from '@chimeres/design';
import {
  Placements,
  type MoveRequest,
  type Placed,
  type PlacementRequest,
} from '../schedule/placement-dialog';
import { CellPlacements, type CellPlacementRequest } from '../schedule/cell-placement-dialog';
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
  participants: [],
  warnings: [],
  reserve: [],
  draw: null,
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

/** Un scénario de la réserve, programmé sur les créneaux `scheduledOn`. */
const reserveScenario = (
  id: string,
  title: string,
  scheduledOn: string[] = [],
): ReserveScenarioDto => ({
  id,
  title,
  system: 'Cthulhu',
  seats: { min: 3, max: 4 },
  duration: 1,
  imageUrl: null,
  gameMaster: { id: `g-${id}`, nickname: 'Mira' },
  timeSlots: ['s1', 's2', 's3'].map((timeSlotId) => ({
    timeSlotId,
    inReserve: !scheduledOn.includes(timeSlotId),
    scheduled: scheduledOn.includes(timeSlotId),
  })),
  unschedulable: null,
});

/** La réserve : « Abysses », programmé au créneau 1, « Aube » et « Cendres ». */
const ABYSSES = reserveScenario('r1', 'Abysses', ['s1']);
const AUBE = reserveScenario('r3', 'Aube');
const CENDRES = reserveScenario('r2', 'Cendres');

/** Au créneau 2 : « Abysses » et « Cendres » programmables ; « Aube » non, toutes les tables prises. */
const RESERVE_OF_SLOT_2: TimeSlotTrackingDto['reserve'] = [
  { scenarioId: 'r1', refusal: null },
  { scenarioId: 'r2', refusal: null },
  {
    scenarioId: 'r3',
    refusal: {
      code: 'no-free-table',
      title: 'Aucune table libre',
      detail: `Toutes les tables sont prises sur le créneau 2.`,
    },
  },
];

/**
 * Les participants du créneau 2 : Anna (« Brumes »), qui risque de ne pas être placée ; Sven
 * (« Néons »), qui risque de rester sans table ; Lune, inscrite aux deux.
 */
/** Un participant sans partie sur le créneau 2. */
const WITHOUT_GAME: TrackedParticipantDto = {
  id: 'u4',
  nickname: 'Bastou',
  gameIds: [],
  risk: 'without-game',
};

const PARTICIPANTS: TrackedParticipantDto[] = [
  { id: 'u1', nickname: 'Anna', gameIds: ['p1'], risk: 'may-not-be-placed' },
  { id: 'u2', nickname: 'Sven', gameIds: ['p3'], risk: 'may-be-left-without-table' },
  { id: 'u3', nickname: 'Lune', gameIds: ['p1', 'p3'], risk: null },
];

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
    timeSlot(2, '13:00', '15:30', {
      demand: 26,
      capacity: { min: 14, max: 22 },
      participants: PARTICIPANTS,
      reserve: RESERVE_OF_SLOT_2,
    }),
    timeSlot(3, '16:00', '18:30', { capacity: { min: 4, max: 4 } }),
  ],
  tables: [
    { id: 't1', name: 'Dragon' },
    { id: 't2', name: 'Licorne' },
    { id: 't3', name: 'Phénix' },
    { id: 't4', name: 'Sphinx' },
  ],
  games: [BRUMES, EPICE, NEONS],
  reserve: [ABYSSES, AUBE, CENDRES],
};

/**
 * Le tirage provisoire du créneau 2 : Anna et Lune à « Brumes », Lune déplacée à la main ; Sven
 * à « Brumes » sans y être inscrit ; Bastou non placé. Chiffres d'un tirage plus grand, pour la tuile.
 */
const DRAW_OF_SLOT_2: DrawTrackingDto = {
  published: false,
  participantCount: 26,
  assignedCount: 19,
  unassignedCount: 7,
  gameCount: 5,
  gamesAtMinimumCount: 4,
  freeSeatCount: 3,
  tablesWithSeats: [{ tableId: 't4', name: 'Sphinx', freeSeatCount: 3 }],
  games: [
    {
      gameId: 'p1',
      cancelled: false,
      playerCount: 5,
      belowMinimum: false,
      withoutPlayers: false,
      overMaximum: true,
      freeSeatCount: 0,
      surplusPlayerCount: 1,
      cancellable: false,
      gameMasterSignedUpGameIds: [],
    },
    {
      gameId: 'p3',
      cancelled: false,
      playerCount: 0,
      belowMinimum: false,
      withoutPlayers: true,
      overMaximum: false,
      freeSeatCount: 4,
      surplusPlayerCount: 0,
      cancellable: true,
      gameMasterSignedUpGameIds: ['p1'],
    },
  ],
  assignments: [
    {
      participantId: 'u1',
      nickname: 'Anna',
      gameId: 'p1',
      movedByHand: false,
      signedUpGameIds: ['p1'],
      playsWithoutSignUp: false,
    },
    {
      participantId: 'u4',
      nickname: 'Bastou',
      gameId: null,
      movedByHand: false,
      signedUpGameIds: ['p3'],
      playsWithoutSignUp: false,
    },
    {
      participantId: 'u3',
      nickname: 'Lune',
      gameId: 'p1',
      movedByHand: true,
      signedUpGameIds: ['p1', 'p3'],
      playsWithoutSignUp: false,
    },
    {
      participantId: 'u2',
      nickname: 'Sven',
      gameId: 'p1',
      movedByHand: false,
      signedUpGameIds: ['p3'],
      playsWithoutSignUp: true,
    },
  ],
  signals: [],
};

/** Le suivi, le créneau 2 en tirage provisoire. */
const DRAWING: SignUpTrackingDto = {
  ...TRACKING,
  timeSlots: TRACKING.timeSlots.map((slot) =>
    slot.id === 's2'
      ? { ...slot, state: 'drawing', warnings: [], reserve: [], draw: DRAW_OF_SLOT_2 }
      : slot,
  ),
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

/** Le bouton « ⋯ » du créneau en tirage, nommé par son `aria-label`, ou `null`. */
const moreMenuOf = (host: HTMLElement) =>
  host.querySelector<HTMLButtonElement>('button[aria-label="Autres actions sur le créneau"]');

/** Ouvre « ⋯ » du créneau en tirage, et y choisit l'entrée `name`. */
async function chooseInMenu(host: HTMLElement, settle: () => Promise<void>, name: string) {
  moreMenuOf(host)!.click();
  await settle();
  [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    .find((item) => text(item) === name)!
    .click();
  await settle();
}

describe('Pilotage du jour J', () => {
  /** Le dialogue de placement, qui a sa propre spec : il rend ce que le test lui fait rendre. */
  let moveTo: ReturnType<typeof vi.fn<(request: MoveRequest) => Promise<Placed | undefined>>>;
  let scheduleOn: ReturnType<
    typeof vi.fn<(request: PlacementRequest) => Promise<ScheduleDto | undefined>>
  >;
  /** Le dialogue de « Programmer ici… » sur une table libre, qui a sa propre spec. */
  let scheduleOnCell: ReturnType<
    typeof vi.fn<(request: CellPlacementRequest) => Promise<ScheduleDto | undefined>>
  >;

  beforeEach(() => {
    moveTo = vi.fn<(request: MoveRequest) => Promise<Placed | undefined>>();
    scheduleOn = vi.fn<(request: PlacementRequest) => Promise<ScheduleDto | undefined>>();
    scheduleOnCell = vi.fn<(request: CellPlacementRequest) => Promise<ScheduleDto | undefined>>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Placements, useValue: { moveTo, scheduleOn } },
        { provide: CellPlacements, useValue: { scheduleOn: scheduleOnCell } },
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
        .flush({ removedSignUps, erasedDrawTimeSlotId: null });
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

  it('choisit à l’ouverture le premier créneau dont le tirage n’est pas publié', async () => {
    const { tiles, summary } = await render();

    expect(tiles().map((tile) => tile.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(text(summary()?.querySelector('h2'))).toBe('Créneau 2 · 13 h 00 – 15 h 30');
  });

  it('atténue la tuile d’un créneau publié, avec son état', async () => {
    const { tiles } = await render();

    expect(tiles()[0]!.classList).toContain('closed');
    expect(text(tiles()[0])).toBe('Créneau 1 9 h 00 – 11 h 30 Tirage publié');
  });

  it('montre sur la tuile d’un créneau en tirage les placés face aux participants, sans jauge', async () => {
    const { tiles } = await render(DRAWING);

    expect(tiles()[1]!.classList).not.toContain('closed');
    expect(text(tiles()[1])).toBe(
      'Créneau 2 13 h 00 – 15 h 30 19 / 26 placés / participants Tirage provisoire',
    );
    expect(tiles()[1]!.querySelector('app-gauge')).toBeNull();
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

  describe('lancer le tirage', () => {
    it('offre « Lancer le tirage » sur le seul premier créneau dont le tirage n’est pas publié', async () => {
      const { fixture, tiles, summary, button } = await render();

      expect(button('Lancer le tirage')).toBeDefined();
      tiles()[2]!.click();
      fixture.detectChanges();

      expect(button('Lancer le tirage')).toBeUndefined();
      expect(text(summary())).toContain(
        'Le tirage de ce créneau se lance après la publication du créneau 2.',
      );
    });

    it('demande une confirmation qui rappelle les inscrits, les places et les avertissements rouges', async () => {
      const { button, dialog, settle } = await render({
        ...TRACKING,
        timeSlots: TRACKING.timeSlots.map((slot) =>
          slot.id === 's2'
            ? {
                ...slot,
                warnings: [
                  {
                    code: 'seats-missing',
                    level: 'danger',
                    title: 'Il manque 4 places',
                    detail: '26 participants pour 22 places au plus.',
                  },
                  {
                    code: 'nearly-full',
                    level: 'warning',
                    title: 'Presque plein',
                    detail: 'Rien de grave.',
                  },
                ],
              }
            : slot,
        ),
      });

      button('Lancer le tirage')!.click();
      await settle();

      expect(text(dialog()?.querySelector('h2'))).toBe('Lancer le tirage du créneau 2 ?');
      expect([...dialog()!.querySelectorAll('p')].map((paragraph) => text(paragraph))).toEqual([
        '26 participants sont inscrits sur ce créneau, pour 14 à 22 places.',
        'Il manque 4 places. 26 participants pour 22 places au plus.',
        "Les inscriptions du créneau seront fermées. Personne n'est notifié avant la publication.",
      ]);
      expect(document.activeElement?.textContent?.trim()).toBe('Annuler');
      expect(
        [...dialog()!.querySelectorAll('button')].find(
          (candidate) => text(candidate) === 'Lancer le tirage',
        )?.classList,
      ).toContain('primary');
    });

    it('lance le tirage, puis relit le suivi et l’annonce', async () => {
      const { http, button, dialog, settle, reread } = await render();
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');
      button('Lancer le tirage')!.click();
      await settle();

      [...dialog()!.querySelectorAll('button')]
        .find((candidate) => text(candidate) === 'Lancer le tirage')!
        .click();
      http
        .expectOne({
          method: 'POST',
          url: apiUrl(drawEndpoints.launch, { timeSlotId: 's2' }),
        })
        .flush(null, { status: 204, statusText: 'No Content' });
      await reread(DRAWING);

      expect(announce).toHaveBeenCalledWith('Tirage du créneau 2 lancé.');
      expect(dialog()).toBeNull();
    });

    it('affiche un refus dans le dialogue, puis relit le suivi à sa fermeture', async () => {
      const { http, button, dialog, settle, reread } = await render();
      button('Lancer le tirage')!.click();
      await settle();
      [...dialog()!.querySelectorAll('button')]
        .find((candidate) => text(candidate) === 'Lancer le tirage')!
        .click();
      const problem: Partial<ProblemDto> = {
        status: 422,
        code: 'draw-already-launched',
        title: 'Tirage déjà lancé',
        detail: 'Le tirage du créneau 2 est déjà lancé.',
      };

      http
        .expectOne(apiUrl(drawEndpoints.launch, { timeSlotId: 's2' }))
        .flush(problem, { status: 422, statusText: 'Refus' });
      await settle();
      expect(text(dialog()?.querySelector('[role="alert"]'))).toBe(
        'Le tirage du créneau 2 est déjà lancé.',
      );
      [...dialog()!.querySelectorAll('button')]
        .find((candidate) => text(candidate) === 'Fermer')!
        .click();
      await reread(DRAWING);
    });
  });

  describe('créneau en tirage provisoire', () => {
    it('résume le tirage, sans avertissement de suivi ni bouton de lancement', async () => {
      const { summary, button } = await render(DRAWING);

      expect(text(summary())).toBe(
        "Créneau 2 · 13 h 00 – 15 h 30 Relancer le tirage Publier le tirage Programmer depuis la réserve… Rouvrir les inscriptions Tirage provisoire 19 / 26 placés 7 non placés 4 / 5 parties au minimum Les inscriptions du créneau sont fermées. Personne n'est notifié avant la publication.",
      );
      expect(button('Lancer le tirage')).toBeUndefined();
    });

    it('montre les signaux du tirage dans l’ordre reçu, un par ligne, avant la phrase des inscriptions fermées', async () => {
      const { summary } = await render({
        ...DRAWING,
        timeSlots: DRAWING.timeSlots.map((slot) =>
          slot.draw
            ? {
                ...slot,
                draw: {
                  ...slot.draw,
                  signals: [
                    {
                      code: 'games-over-maximum',
                      level: 'warning',
                      title: '1 partie au-delà de son maximum',
                      detail: '« Brumes » : 5 joueurs pour 4 places.',
                    },
                    {
                      code: 'participants-unassigned',
                      level: 'danger',
                      title: '7 non placés',
                      detail: 'Il reste 3 places dans les parties du créneau.',
                    },
                  ],
                },
              }
            : slot,
        ),
      });
      const signals = [...summary()!.querySelectorAll('.signals li')];

      expect(signals.map((signal) => text(signal))).toEqual([
        '1 partie au-delà de son maximum « Brumes » : 5 joueurs pour 4 places.',
        '7 non placés Il reste 3 places dans les parties du créneau.',
      ]);
      expect(signals.map((signal) => signal.className)).toEqual(['warning', 'danger']);
      expect(signals.every((signal) => signal.querySelector('app-icon'))).toBe(true);
      expect(text(summary())).toMatch(
        /4 \/ 5 parties au minimum 1 partie au-delà .* Les inscriptions du créneau sont fermées/,
      );
    });

    it('remplace les onglets par le plan de salle : « Non placés » en tête, puis une carte par partie, dans l’ordre des tables', async () => {
      const { host, tabs } = await render(DRAWING);
      const cards = [...host.querySelectorAll('app-draw-plan .plan > li')];

      expect(tabs()).toEqual([]);
      expect(cards.map((card) => text(card.querySelector('h3')))).toEqual([
        'Non placés',
        'Brumes',
        'Épice',
        'Néons',
      ]);
      expect(text(cards[0])).toBe(
        'Non placés 7 participants · 3 places libres dans le créneau Bastou',
      );
      expect(cards[0]!.classList).toContain('unassigned');
    });

    it('montre sur la carte d’une partie ses joueurs, ses places, son écart et ses badges', async () => {
      const { host } = await render(DRAWING);
      const [, brumes, , neons] = [...host.querySelectorAll('app-draw-plan .plan > li')];

      expect(text(brumes)).toBe(
        'Dragon Brumes Cthulhu · Kaïros 5 joueurs · 3 à 4 places · 1 de trop Au-delà du maximum Anna Lune , déplacé à la main Sven , pas inscrit à cette partie',
      );
      expect(text(neons)).toContain('0 joueur · 3 à 4 places · 4 places libres');
      expect(neons!.querySelector('app-two-slot-badge')).not.toBeNull();
    });

    it('marque un joueur déplacé à la main, et celui qui joue sans inscription', async () => {
      const { host } = await render(DRAWING);
      const pills = [...host.querySelectorAll<HTMLElement>('app-draw-plan .players > li')];
      const pill = (nickname: string) =>
        pills.find((candidate) => text(candidate.querySelector('.nickname')) === nickname)!;

      expect(pill('Lune').classList).toContain('moved');
      expect(pill('Lune').querySelector('app-icon')).not.toBeNull();
      expect(pill('Sven').classList).toContain('unregistered');
      expect(pill('Anna').className).toBe('');
    });

    it('atténue le second créneau d’une partie double, tirée avec son premier, avec ses joueurs', async () => {
      const { host } = await render({
        ...TRACKING,
        timeSlots: TRACKING.timeSlots.map((slot) =>
          slot.id === 's1'
            ? {
                ...slot,
                draw: {
                  ...DRAW_OF_SLOT_2,
                  published: true,
                  games: [],
                  assignments: [{ ...DRAW_OF_SLOT_2.assignments[0]!, gameId: 'p2' }],
                },
              }
            : slot.id === 's2'
              ? { ...slot, state: 'drawing', draw: DRAW_OF_SLOT_2 }
              : slot,
        ),
      });
      const epice = [...host.querySelectorAll('app-draw-plan .plan > li')][2]!;

      expect(epice.classList).toContain('second-slot');
      expect(text(epice)).toBe(
        'Licorne Épice Cthulhu · Kaïros Partie double, tirée avec le créneau 1 Anna',
      );
    });
  });

  describe('relancer le tirage et rouvrir les inscriptions', () => {
    /** Le suivi, le créneau 2 en tirage provisoire, sans déplacement à la main. */
    const WITHOUT_MOVES: SignUpTrackingDto = {
      ...DRAWING,
      timeSlots: DRAWING.timeSlots.map((slot) =>
        slot.draw
          ? {
              ...slot,
              draw: {
                ...slot.draw,
                assignments: slot.draw.assignments.map((assignment) => ({
                  ...assignment,
                  movedByHand: false,
                })),
              },
            }
          : slot,
      ),
    };
    const dialogButton = (dialog: HTMLElement | null, name: string) =>
      [...dialog!.querySelectorAll('button')].find((candidate) => text(candidate) === name)!;

    it('relance sans confirmation un tirage sans déplacement, puis relit le suivi et l’annonce', async () => {
      const { http, button, dialog, settle, reread } = await render(WITHOUT_MOVES);
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');

      expect(button('Relancer le tirage')!.classList).toContain('secondary');
      button('Relancer le tirage')!.click();
      await settle();

      expect(dialog()).toBeNull();
      http
        .expectOne({ method: 'POST', url: apiUrl(drawEndpoints.rerun, { timeSlotId: 's2' }) })
        .flush(null, { status: 204, statusText: 'No Content' });
      await reread(WITHOUT_MOVES);
      expect(announce).toHaveBeenCalledWith('Tirage du créneau 2 relancé.');
    });

    it('relance sans confirmation : un refus part en alerte, puis le suivi se relit', async () => {
      const { http, button, settle, reread } = await render(WITHOUT_MOVES);
      const error = vi.spyOn(TestBed.inject(Alerts), 'error');
      button('Relancer le tirage')!.click();
      await settle();

      http
        .expectOne(apiUrl(drawEndpoints.rerun, { timeSlotId: 's2' }))
        .flush(
          { status: 422, code: 'draw-published', title: 'Tirage publié', detail: 'Publié.' },
          { status: 422, statusText: 'Refus' },
        );
      await reread(WITHOUT_MOVES);

      expect(error).toHaveBeenCalledWith({ title: 'Tirage publié', detail: 'Publié.' });
    });

    it('demande une confirmation rouge quand la relance efface des déplacements à la main', async () => {
      const { http, button, dialog, settle, reread } = await render(DRAWING);
      button('Relancer le tirage')!.click();
      await settle();

      expect(text(dialog()?.querySelector('h2'))).toBe('Relancer le tirage du créneau 2 ?');
      expect([...dialog()!.querySelectorAll('p')].map((paragraph) => text(paragraph))).toEqual([
        'Ton déplacement sera effacé : le tirage repart des inscriptions.',
      ]);
      expect(document.activeElement?.textContent?.trim()).toBe('Annuler');
      const confirm = dialogButton(dialog(), 'Relancer le tirage');
      expect(confirm.classList).toContain('danger');
      confirm.click();
      http
        .expectOne({ method: 'POST', url: apiUrl(drawEndpoints.rerun, { timeSlotId: 's2' }) })
        .flush(null, { status: 204, statusText: 'No Content' });
      await reread(WITHOUT_MOVES);
      expect(dialog()).toBeNull();
    });

    it('compte les déplacements au pluriel', async () => {
      const { button, dialog, settle } = await render({
        ...DRAWING,
        timeSlots: DRAWING.timeSlots.map((slot) =>
          slot.draw
            ? {
                ...slot,
                draw: {
                  ...slot.draw,
                  assignments: slot.draw.assignments.map((assignment) => ({
                    ...assignment,
                    movedByHand: true,
                  })),
                },
              }
            : slot,
        ),
      });
      button('Relancer le tirage')!.click();
      await settle();

      expect(text(dialog()?.querySelector('p'))).toBe(
        'Tes 4 déplacements seront effacés : le tirage repart des inscriptions.',
      );
    });

    it('« ⋯ » puis « Rouvrir les inscriptions » : confirmation rouge, puis le résumé et les onglets reviennent', async () => {
      const { http, host, button, dialog, settle, reread, tabs } = await render(DRAWING);
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');

      await chooseInMenu(host, settle, 'Rouvrir les inscriptions');

      expect(text(dialog()?.querySelector('h2'))).toBe('Rouvrir les inscriptions du créneau 2 ?');
      expect([...dialog()!.querySelectorAll('p')].map((paragraph) => text(paragraph))).toEqual([
        'Le résultat provisoire sera effacé, avec ses déplacements et ses parties annulées.',
        "Personne n'est notifié : chacun retrouve ses inscriptions, et peut en changer jusqu'au prochain tirage.",
      ]);
      const confirm = dialogButton(dialog(), 'Rouvrir les inscriptions');
      expect(confirm.classList).toContain('danger');
      confirm.click();
      http
        .expectOne({
          method: 'DELETE',
          url: apiUrl(drawEndpoints.reopenSignUps, { timeSlotId: 's2' }),
        })
        .flush(null, { status: 204, statusText: 'No Content' });
      await reread(TRACKING);

      expect(announce).toHaveBeenCalledWith('Inscriptions du créneau 2 rouvertes.');
      expect(tabs()).toHaveLength(3);
      expect(button('Lancer le tirage')).toBeDefined();
      expect(document.activeElement?.id).toBe('summary-title');
    });

    it('n’offre ni relance ni réouverture sur un créneau ouvert ou publié', async () => {
      const { fixture, host, tiles, button } = await render(DRAWING);

      for (const tile of [0, 2]) {
        tiles()[tile]!.click();
        fixture.detectChanges();

        expect(button('Relancer le tirage')).toBeUndefined();
        expect(moreMenuOf(host)).toBeNull();
      }
    });
  });

  describe('programmer depuis la réserve un créneau en tirage (TI-6)', () => {
    /** Le créneau 2 en tirage provisoire, avec sa réserve. */
    const DRAWING_WITH_RESERVE: SignUpTrackingDto = {
      ...DRAWING,
      timeSlots: DRAWING.timeSlots.map((slot) =>
        slot.id === 's2' ? { ...slot, reserve: RESERVE_OF_SLOT_2 } : slot,
      ),
    };
    /** Les verdicts de « Cendres » : Phénix libre au créneau 2, dont le tirage serait effacé. */
    const CENDRES_PLACEMENTS: PlacementDto[] = TRACKING.tables.flatMap((table) =>
      ['s1', 's2', 's3'].map((timeSlotId) =>
        timeSlotId === 's2' && table.id === 't3'
          ? { timeSlotId, tableId: table.id, refusal: null, erasedDrawTimeSlotId: 's2' }
          : {
              timeSlotId,
              tableId: table.id,
              refusal: { code: 'table-taken', title: 'Table prise', detail: 'Table prise.' },
              erasedDrawTimeSlotId: null,
            },
      ),
    );
    const placementDialog = () =>
      document.querySelector<HTMLElement>('app-reserve-scheduling-dialog');

    it('ouvre la réserve du créneau, puis ses tables libres, puis la confirmation rouge', async () => {
      const { http, host, dialog, settle, reread } = await render(DRAWING_WITH_RESERVE);
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');

      await chooseInMenu(host, settle, 'Programmer depuis la réserve…');

      expect(text(placementDialog()?.querySelector('h2'))).toBe(
        'Programmer depuis la réserve du créneau 2',
      );
      const cards = [...placementDialog()!.querySelectorAll('app-reserve-scenario-card')];
      expect(cards.map((card) => text(card.querySelector('h3')))).toEqual([
        'Abysses',
        'Cendres',
        'Aube',
      ]);
      cards[1]!.querySelector('button')!.click();
      // Pas de `whenStable()` avant de servir les verdicts : leur lecture garde l'application instable.
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      http
        .expectOne(apiUrl(scheduleEndpoints.placements, { scenarioId: 'r2' }))
        .flush(CENDRES_PLACEMENTS);
      await settle();

      expect(text(placementDialog()?.querySelector('h2'))).toBe(
        'Programmer « Cendres » sur le créneau 2',
      );
      const tables = [...placementDialog()!.querySelectorAll('ul button')];
      expect(tables.map((table) => text(table))).toEqual(['Programmer sur Phénix']);
      expect(document.activeElement).toBe(tables[0]);
      (tables[0] as HTMLButtonElement).click();
      await settle();

      expect([...dialog()!.querySelectorAll('h2, p')].map((element) => text(element))).toEqual([
        'Programmer « Cendres » sur le créneau 2, Phénix ?',
        'Le tirage provisoire sera effacé, avec ses déplacements et ses parties annulées, et les inscriptions du créneau 2 rouvertes.',
        "Tous ceux qui peuvent s'inscrire sur ce créneau reçoivent la notification « nouvelle partie », qui annonce la réouverture. Tu relanceras le tirage ensuite.",
      ]);
      const confirm = [...dialog()!.querySelectorAll('button')].find(
        (candidate) => text(candidate) === 'Programmer la partie',
      )!;
      expect(confirm.classList).toContain('danger');
      http.expectNone(apiUrl(scheduleEndpoints.schedule));
      confirm.click();
      const request = http.expectOne(apiUrl(scheduleEndpoints.schedule));
      expect(request.request.body).toEqual({ scenarioId: 'r2', timeSlotId: 's2', tableId: 't3' });
      const cendres = game('p9', 'Cendres', 't3', ['s2']);
      request.flush({ games: [BRUMES, EPICE, NEONS, cendres], reserve: [] });
      await reread({ ...TRACKING, games: [BRUMES, EPICE, NEONS, cendres] });

      expect(placementDialog()).toBeNull();
      expect(announce).toHaveBeenCalledWith(
        `Partie «${NBSP}Cendres${NBSP}» programmée${NBSP}: créneau 2, Phénix.`,
      );
      expect(document.activeElement?.id).toBe('summary-title');
    });

    it('« Retour à la réserve » revient aux cartes, « Annuler » ferme sans rien écrire', async () => {
      const { http, host, settle, reread } = await render(DRAWING_WITH_RESERVE);
      await chooseInMenu(host, settle, 'Programmer depuis la réserve…');
      placementDialog()!
        .querySelectorAll('app-reserve-scenario-card')[1]!
        .querySelector('button')!
        .click();
      // Pas de `whenStable()` avant de servir les verdicts : leur lecture garde l'application instable.
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
      http
        .expectOne(apiUrl(scheduleEndpoints.placements, { scenarioId: 'r2' }))
        .flush(CENDRES_PLACEMENTS);
      await settle();

      [...placementDialog()!.querySelectorAll('button')]
        .find((candidate) => text(candidate) === 'Retour à la réserve')!
        .click();
      await settle();
      expect(placementDialog()!.querySelectorAll('app-reserve-scenario-card')).toHaveLength(3);

      placementDialog()!.querySelector<HTMLButtonElement>('.cancel')!.click();
      await reread(DRAWING_WITH_RESERVE);
      expect(placementDialog()).toBeNull();
      http.expectNone(apiUrl(scheduleEndpoints.schedule));
    });
  });

  describe('publier le tirage', () => {
    /**
     * Le créneau 2 en tirage provisoire : « Brumes » au-delà de son maximum, « Néons » sous son
     * minimum, avec 2 joueurs.
     */
    const PUBLISHABLE: SignUpTrackingDto = {
      ...DRAWING,
      timeSlots: DRAWING.timeSlots.map((slot) =>
        slot.draw
          ? {
              ...slot,
              draw: {
                ...slot.draw,
                games: [
                  slot.draw.games[0]!,
                  {
                    ...slot.draw.games[1]!,
                    playerCount: 2,
                    belowMinimum: true,
                    withoutPlayers: false,
                    freeSeatCount: 2,
                  },
                ],
              },
            }
          : slot,
      ),
    };
    /** Le suivi, le créneau 2 publié. */
    const PUBLISHED: SignUpTrackingDto = {
      ...PUBLISHABLE,
      timeSlots: PUBLISHABLE.timeSlots.map((slot) =>
        slot.draw ? { ...slot, state: 'published', draw: { ...slot.draw, published: true } } : slot,
      ),
    };
    const dialogButton = (dialog: HTMLElement | null, name: string) =>
      [...dialog!.querySelectorAll('button')].find((candidate) => text(candidate) === name)!;

    it('offre « Publier le tirage », bouton principal, sur un créneau en tirage provisoire', async () => {
      const { button } = await render(DRAWING);

      expect(button('Publier le tirage')!.classList).toContain('primary');
      expect(button('Publier le tirage')!.disabled).toBe(false);
    });

    it('publie après une confirmation orange, puis relit le suivi et l’annonce', async () => {
      const { http, button, dialog, settle, reread } = await render(PUBLISHABLE);
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');
      button('Publier le tirage')!.click();
      await settle();

      expect(text(dialog()?.querySelector('h2'))).toBe('Publier le tirage du créneau 2 ?');
      expect([...dialog()!.querySelectorAll('p')].map((paragraph) => text(paragraph))).toEqual([
        '19 participants sont placés, 7 ne le sont pas. Chacun reçoit sa notification, ainsi que les MJ.',
        '« Brumes » est jouée au-delà de son maximum : 5 joueurs pour 4 places.',
        '« Néons » est jouée sous son minimum : 2 joueurs pour 3 places au moins.',
        'Le résultat ne pourra plus être modifié.',
      ]);
      expect(
        [...dialog()!.querySelectorAll('p.warning')].map((paragraph) =>
          paragraph.querySelector('app-icon') ? text(paragraph).slice(0, 10) : null,
        ),
      ).toEqual(['« Brumes »', '« Néons » ']);
      expect(document.activeElement?.textContent?.trim()).toBe('Annuler');
      const confirm = dialogButton(dialog(), 'Publier le tirage');
      expect(confirm.classList).toContain('primary');
      confirm.click();
      http
        .expectOne({ method: 'POST', url: apiUrl(drawEndpoints.publish, { timeSlotId: 's2' }) })
        .flush(null, { status: 204, statusText: 'No Content' });
      await reread(PUBLISHED);

      expect(dialog()).toBeNull();
      expect(announce).toHaveBeenCalledWith('Tirage du créneau 2 publié.');
    });

    it('dit « 1 participant est placé », sans non placé', async () => {
      const { button, dialog, settle } = await render({
        ...PUBLISHABLE,
        timeSlots: PUBLISHABLE.timeSlots.map((slot) =>
          slot.draw
            ? { ...slot, draw: { ...slot.draw, assignedCount: 1, unassignedCount: 0, games: [] } }
            : slot,
        ),
      });
      button('Publier le tirage')!.click();
      await settle();

      expect([...dialog()!.querySelectorAll('p')].map((paragraph) => text(paragraph))).toEqual([
        '1 participant est placé. Chacun reçoit sa notification, ainsi que les MJ.',
        'Le résultat ne pourra plus être modifié.',
      ]);
    });

    it('liste les parties annulées dont le MJ est notifié, après les parties jouées hors de leurs places (TI-7)', async () => {
      const { button, dialog, settle } = await render({
        ...PUBLISHABLE,
        timeSlots: PUBLISHABLE.timeSlots.map((slot) =>
          slot.draw
            ? {
                ...slot,
                draw: {
                  ...slot.draw,
                  games: [
                    slot.draw.games[0]!,
                    { ...slot.draw.games[1]!, cancelled: true, cancellable: false },
                  ],
                },
              }
            : slot,
        ),
      });
      button('Publier le tirage')!.click();
      await settle();

      expect([...dialog()!.querySelectorAll('p')].map((paragraph) => text(paragraph))).toEqual([
        '19 participants sont placés, 7 ne le sont pas. Chacun reçoit sa notification, ainsi que les MJ.',
        '« Brumes » est jouée au-delà de son maximum : 5 joueurs pour 4 places.',
        '« Néons » est annulée : elle quitte le programme, et Kaïros, son MJ, reçoit la notification « partie annulée ».',
        'Le résultat ne pourra plus être modifié.',
      ]);
      expect(dialog()!.querySelectorAll('p.warning')).toHaveLength(1);
    });

    it('montre le refus dans le dialogue', async () => {
      const { http, button, dialog, settle } = await render(DRAWING);
      button('Publier le tirage')!.click();
      await settle();
      dialogButton(dialog(), 'Publier le tirage').click();

      http.expectOne(apiUrl(drawEndpoints.publish, { timeSlotId: 's2' })).flush(
        {
          status: 422,
          code: 'games-without-players',
          title: 'Partie sans joueur',
          detail: "1 partie du créneau 2 n'a aucun joueur : annule-la pour publier le tirage.",
        },
        { status: 422, statusText: 'Refus' },
      );
      await settle();

      expect(text(dialog()?.querySelector('[role="alert"]'))).toBe(
        "1 partie du créneau 2 n'a aucun joueur : annule-la pour publier le tirage.",
      );
    });

    it('résume un créneau publié : cadenas, chiffres, notifications parties, places restantes, sans geste', async () => {
      const { fixture, host, summary, button, tiles } = await render(PUBLISHED);
      tiles()[1]!.click();
      fixture.detectChanges();

      expect(tiles()[1]!.classList).toContain('closed');
      expect(text(tiles()[1])).toContain('19 / 26 placés / participants Tirage publié');
      expect(text(summary())).toBe(
        'Créneau 2 · 13 h 00 – 15 h 30 Tirage publié 19 / 26 placés 7 non placés 4 / 5 parties au minimum Tirage publié : les participants et les MJ ont reçu leur notification, et le résultat ne change plus. Il reste de la place : Sphinx (3 places). Les non placés vont voir leur MJ.',
      );
      expect(summary()!.querySelector('.state.published app-icon')).not.toBeNull();
      for (const name of ['Publier le tirage', 'Relancer le tirage']) {
        expect(button(name)).toBeUndefined();
      }
      expect(moreMenuOf(host)).toBeNull();
    });

    it('ne dit rien des places quand il n’en reste pas', async () => {
      const { fixture, summary, tiles } = await render({
        ...PUBLISHED,
        timeSlots: PUBLISHED.timeSlots.map((slot) =>
          slot.draw ? { ...slot, draw: { ...slot.draw, tablesWithSeats: [] } } : slot,
        ),
      });
      tiles()[1]!.click();
      fixture.detectChanges();

      expect(text(summary())).toContain('Tirage publié :');
      expect(text(summary())).not.toContain('Il reste de la place');
    });
  });

  describe('annuler et rétablir une partie', () => {
    /** Le suivi, le créneau 2 en tirage provisoire, avec ce tirage pour « Néons ». */
    const withNeons = (figures: Partial<DrawGameDto>): SignUpTrackingDto => ({
      ...DRAWING,
      timeSlots: DRAWING.timeSlots.map((slot) =>
        slot.draw
          ? {
              ...slot,
              draw: {
                ...slot.draw,
                games: slot.draw.games.map((drawn) =>
                  drawn.gameId === 'p3' ? { ...drawn, ...figures } : drawn,
                ),
              },
            }
          : slot,
      ),
    });
    const cards = (host: HTMLElement) => [...host.querySelectorAll('app-draw-plan .plan > li')];
    const dialogButton = (dialog: HTMLElement | null, name: string) =>
      [...dialog!.querySelectorAll('button')].find((candidate) => text(candidate) === name)!;

    it('offre « Annuler la partie », discret et rouge, sur la seule partie sous son minimum', async () => {
      const { host } = await render(DRAWING);
      const [, brumes, , neons] = cards(host);

      expect(text(brumes)).not.toContain('Annuler la partie');
      const cancel = neons!.querySelector('button')!;
      expect(text(cancel)).toBe('Annuler la partie');
      expect(cancel.classList).toContain('quiet-danger');
    });

    it('annule après une confirmation rouge, qui garde la partie par défaut, puis relit le suivi et l’annonce', async () => {
      const { host, http, dialog, settle, reread } = await render(DRAWING);
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');
      cards(host)[3]!.querySelector('button')!.click();
      await settle();

      expect(text(dialog()?.querySelector('h2'))).toBe('Annuler « Néons » ?');
      expect([...dialog()!.querySelectorAll('p')].map((paragraph) => text(paragraph))).toEqual([
        'Kaïros, son MJ, redevient participant sur ce créneau et rejoint les non placés, avec son inscription à « Brumes ».',
        'À la publication, son MJ reçoit la notification « partie annulée ».',
      ]);
      expect(document.activeElement?.textContent?.trim()).toBe('Garder la partie');
      const confirm = dialogButton(dialog(), 'Annuler la partie');
      expect(confirm.classList).toContain('danger');
      confirm.click();
      http
        .expectOne({ method: 'PUT', url: apiUrl(drawEndpoints.cancelGame, { gameId: 'p3' }) })
        .flush(null, { status: 204, statusText: 'No Content' });
      await reread(
        withNeons({
          cancelled: true,
          cancellable: false,
          withoutPlayers: false,
          freeSeatCount: 0,
        }),
      );

      expect(dialog()).toBeNull();
      expect(announce).toHaveBeenCalledWith(`Partie «${NBSP}Néons${NBSP}» du créneau 2 annulée.`);
    });

    it('compte les joueurs de la partie, et dit un MJ sans autre inscription « sans partie »', async () => {
      const { host, dialog, settle } = await render(
        withNeons({
          playerCount: 2,
          belowMinimum: true,
          withoutPlayers: false,
          gameMasterSignedUpGameIds: [],
        }),
      );
      cards(host)[3]!.querySelector('button')!.click();
      await settle();

      expect([...dialog()!.querySelectorAll('p')].map((paragraph) => text(paragraph))).toEqual([
        'Ses 2 joueurs passent dans les non placés, sans nouveau tirage.',
        'Kaïros, son MJ, redevient participant sur ce créneau et rejoint les non placés, sans partie.',
        'À la publication, son MJ reçoit la notification « partie annulée ».',
      ]);
    });

    it('atténue une partie annulée, et la rétablit sans confirmation, puis relit le suivi et l’annonce', async () => {
      const cancelled = withNeons({
        cancelled: true,
        cancellable: false,
        withoutPlayers: false,
        freeSeatCount: 0,
      });
      const { host, http, dialog, settle, reread } = await render(cancelled);
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');
      const neons = cards(host)[3]!;

      expect(neons.classList).toContain('cancelled');
      expect(text(neons)).toContain('Annulée Ses joueurs sont passés dans les non placés.');
      expect(text(neons)).not.toContain('joueur ·');
      const restore = neons.querySelector('button')!;
      expect(text(restore)).toBe('Rétablir la partie');
      expect(restore.classList).toContain('quiet');
      restore.click();
      await settle();

      expect(dialog()).toBeNull();
      http
        .expectOne({ method: 'DELETE', url: apiUrl(drawEndpoints.restoreGame, { gameId: 'p3' }) })
        .flush(null, { status: 204, statusText: 'No Content' });
      await reread(DRAWING);
      expect(announce).toHaveBeenCalledWith(`Partie «${NBSP}Néons${NBSP}» rétablie.`);
    });

    it('n’offre aucun geste sur un tirage publié', async () => {
      const { host, fixture, tiles } = await render({
        ...DRAWING,
        timeSlots: DRAWING.timeSlots.map((slot) =>
          slot.draw
            ? { ...slot, state: 'published', draw: { ...slot.draw, published: true } }
            : slot,
        ),
      });
      tiles()[1]!.click();
      fixture.detectChanges();

      expect(cards(host)[3]!.querySelector('button')).toBeNull();
    });
  });

  describe('déplacer un participant', () => {
    const cards = (host: HTMLElement) => [...host.querySelectorAll('app-draw-plan .plan > li')];
    const banner = (host: HTMLElement) => host.querySelector('app-draw-plan .banner');
    const pill = (host: HTMLElement, nickname: string) =>
      [...host.querySelectorAll<HTMLElement>('app-draw-plan .players > li')].find(
        (candidate) => text(candidate.querySelector('.nickname')) === nickname,
      )!;
    const choose = async (host: HTMLElement, settle: () => Promise<void>, nickname: string) => {
      pill(host, nickname).querySelector('button')!.click();
      await settle();
    };
    const targets = (card: Element) =>
      [...card.querySelectorAll<HTMLButtonElement>('.target')].map((target) => text(target));

    it('dit au repos comment déplacer, avec la légende des marques', async () => {
      const { host } = await render(DRAWING);

      expect(text(banner(host))).toBe(
        'Choisis un joueur, puis sa nouvelle table. déplacé à la main Pseudo en jaune : joue sans inscription',
      );
      expect(banner(host)!.textContent).toContain(`jaune${NBSP}: joue`);
      expect(pill(host, 'Bastou').querySelector('button')!.getAttribute('aria-pressed')).toBe(
        'false',
      );
      expect(host.querySelectorAll('app-draw-plan .target')).toHaveLength(0);
    });

    it('choisit un joueur d’un clic : bordure orange, aria-pressed, et ses inscriptions dans le bandeau', async () => {
      const { host, settle } = await render(DRAWING);

      await choose(host, settle, 'Bastou');

      expect(pill(host, 'Bastou').classList).toContain('chosen');
      expect(pill(host, 'Bastou').querySelector('button')!.getAttribute('aria-pressed')).toBe(
        'true',
      );
      expect(text(banner(host))).toBe(
        'Bastou · inscriptions : « Néons ». Choisis sa nouvelle table. Annuler',
      );
    });

    it('dit « sans partie » pour un joueur sans inscription sur le créneau', async () => {
      const { host, settle } = await render({
        ...DRAWING,
        timeSlots: DRAWING.timeSlots.map((slot) =>
          slot.draw
            ? {
                ...slot,
                draw: {
                  ...slot.draw,
                  assignments: slot.draw.assignments.map((assignment) =>
                    assignment.nickname === 'Bastou'
                      ? { ...assignment, signedUpGameIds: [] }
                      : assignment,
                  ),
                },
              }
            : slot,
        ),
      });

      await choose(host, settle, 'Bastou');

      expect(text(banner(host))).toBe('Bastou · sans partie. Choisis sa nouvelle table. Annuler');
      expect(targets(cards(host)[3]!)).toEqual(['Déplacer ici · pas inscrit']);
    });

    it('offre en bas des autres cartes « inscrit » ou « pas inscrit », et le dépassement en jaune', async () => {
      const { host, settle } = await render(DRAWING);

      await choose(host, settle, 'Bastou');

      const [unassigned, brumes, epice, neons] = cards(host);
      expect(targets(unassigned!)).toEqual([]);
      expect(targets(brumes!)).toEqual(['Déplacer ici · pas inscrit']);
      expect(text(brumes!.querySelector('div.gesture p.warning'))).toBe('6 joueurs pour 4 places');
      expect(brumes!.querySelector('.target')!.classList).not.toContain('signed-up');
      expect(targets(epice!)).toEqual([]);
      expect(targets(neons!)).toEqual(['Déplacer ici · inscrit']);
      expect(neons!.querySelector('.target')!.classList).toContain('signed-up');
      expect(neons!.querySelector('p.warning')).toBeNull();
      expect(text(neons)).toContain('Annuler la partie Déplacer ici · inscrit');
    });

    it('n’offre aucune cible sur une partie annulée, ni sur la carte actuelle du joueur', async () => {
      const { host, settle } = await render({
        ...DRAWING,
        timeSlots: DRAWING.timeSlots.map((slot) =>
          slot.draw
            ? {
                ...slot,
                draw: {
                  ...slot.draw,
                  games: slot.draw.games.map((drawn) =>
                    drawn.gameId === 'p3'
                      ? { ...drawn, cancelled: true, cancellable: false, withoutPlayers: false }
                      : drawn,
                  ),
                },
              }
            : slot,
        ),
      });

      await choose(host, settle, 'Anna');

      const [unassigned, brumes, , neons] = cards(host);
      expect(targets(unassigned!)).toEqual(['Retirer de sa table']);
      expect(targets(brumes!)).toEqual([]);
      expect(targets(neons!)).toEqual([]);
      expect(text(neons)).toContain('Rétablir la partie');
    });

    it('déplace vers la nouvelle table, puis relit le suivi et l’annonce', async () => {
      const { host, http, settle, reread } = await render(DRAWING);
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');
      await choose(host, settle, 'Bastou');

      cards(host)[3]!.querySelector<HTMLButtonElement>('.target')!.click();
      await settle();

      const request = http.expectOne({
        method: 'PUT',
        url: apiUrl(drawEndpoints.moveParticipant, { timeSlotId: 's2', participantId: 'u4' }),
      });
      expect(request.request.body).toEqual({ gameId: 'p3' });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await reread(DRAWING);
      expect(announce).toHaveBeenCalledWith(
        `Bastou déplacé${NBSP}: table Sphinx, «${NBSP}Néons${NBSP}».`,
      );
      expect(host.querySelectorAll('app-draw-plan .target')).toHaveLength(0);
    });

    it('retire un joueur de sa table par la carte « Non placés »', async () => {
      const { host, http, settle, reread } = await render(DRAWING);
      const announce = vi.spyOn(TestBed.inject(Announcer), 'announce');
      await choose(host, settle, 'Lune');

      cards(host)[0]!.querySelector<HTMLButtonElement>('.target')!.click();
      await settle();

      const request = http.expectOne({
        method: 'PUT',
        url: apiUrl(drawEndpoints.moveParticipant, { timeSlotId: 's2', participantId: 'u3' }),
      });
      expect(request.request.body).toEqual({ gameId: null });
      request.flush(null, { status: 204, statusText: 'No Content' });
      await reread(DRAWING);
      expect(announce).toHaveBeenCalledWith('Lune retiré de sa table.');
    });

    it('défait le choix par Échap, par « Annuler » et par un second clic', async () => {
      const { host, settle, button } = await render(DRAWING);
      await choose(host, settle, 'Bastou');

      pill(host, 'Bastou')
        .querySelector('button')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(pill(host, 'Bastou').classList).not.toContain('chosen');

      await choose(host, settle, 'Bastou');
      button('Annuler')!.click();
      await settle();
      expect(pill(host, 'Bastou').classList).not.toContain('chosen');

      await choose(host, settle, 'Bastou');
      await choose(host, settle, 'Bastou');
      expect(pill(host, 'Bastou').classList).not.toContain('chosen');
    });

    it('garde le choix à la relecture, tant que le joueur reste dans le tirage', async () => {
      const { host, fixture, settle, reread } = await render(DRAWING);
      const reload = () =>
        (
          fixture.componentInstance as unknown as { tracking: { reload(): void } }
        ).tracking.reload();
      await choose(host, settle, 'Bastou');

      reload();
      await reread(DRAWING);
      expect(pill(host, 'Bastou').classList).toContain('chosen');

      reload();
      await reread({
        ...DRAWING,
        timeSlots: DRAWING.timeSlots.map((slot) =>
          slot.draw
            ? {
                ...slot,
                draw: {
                  ...slot.draw,
                  assignments: slot.draw.assignments.filter(
                    ({ nickname }) => nickname !== 'Bastou',
                  ),
                },
              }
            : slot,
        ),
      });
      expect(text(banner(host))).toContain('Choisis un joueur, puis sa nouvelle table.');
      expect(host.querySelectorAll('app-draw-plan .target')).toHaveLength(0);
    });

    it('montre un refus en alerte, puis relit le suivi', async () => {
      const { host, http, settle, reread } = await render(DRAWING);
      await choose(host, settle, 'Bastou');
      cards(host)[3]!.querySelector<HTMLButtonElement>('.target')!.click();
      await settle();

      http
        .expectOne(apiUrl(drawEndpoints.moveParticipant, { timeSlotId: 's2', participantId: 'u4' }))
        .flush(
          { status: 422, code: 'game-cancelled', title: 'Partie annulée' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      await reread(DRAWING);

      expect(TestBed.inject(Alerts).notices()).toEqual([
        expect.objectContaining({ title: 'Partie annulée' }),
      ]);
      expect(pill(host, 'Bastou').classList).toContain('chosen');
    });

    it('n’offre ni choix ni cible sur un tirage publié', async () => {
      const { host, fixture, tiles } = await render({
        ...DRAWING,
        timeSlots: DRAWING.timeSlots.map((slot) =>
          slot.draw
            ? { ...slot, state: 'published', draw: { ...slot.draw, published: true } }
            : slot,
        ),
      });
      tiles()[1]!.click();
      fixture.detectChanges();

      expect(host.querySelector('app-draw-plan .players button')).toBeNull();
      expect(banner(host)).toBeNull();
    });
  });

  describe('avertissements de suivi', () => {
    /** Les avertissements du créneau 2, dans l'ordre de l'API. */
    const WARNINGS: TimeSlotTrackingDto['warnings'] = [
      {
        code: 'seats-missing',
        level: 'danger',
        title: 'Il manque 4 places',
        detail: '26 participants pour 22 places au plus.',
      },
      {
        code: 'participants-may-not-be-placed',
        level: 'danger',
        title: '1 participant risque de ne pas être placé',
        detail: 'Toutes ses parties du créneau sont très demandées.',
      },
      {
        code: 'games-below-minimum',
        level: 'warning',
        title: '1 partie sous son minimum',
        detail: '1 participant risque de rester sans table.',
      },
    ];

    /** Le suivi, avec ces avertissements au créneau 2. */
    const withWarnings = (warnings: TimeSlotTrackingDto['warnings']): SignUpTrackingDto => ({
      ...TRACKING,
      timeSlots: TRACKING.timeSlots.map((slot) => (slot.rank === 2 ? { ...slot, warnings } : slot)),
    });

    const lines = (summary: Element | null) => [
      ...(summary?.querySelectorAll('.warnings li') ?? []),
    ];

    it('montre un avertissement par ligne, dans l’ordre reçu, avec son icône et son bouton', async () => {
      const { summary } = await render(withWarnings(WARNINGS));

      expect(lines(summary()).map(text)).toEqual([
        'Il manque 4 places 26 participants pour 22 places au plus. Voir la réserve',
        '1 participant risque de ne pas être placé Toutes ses parties du créneau sont très demandées. Voir les participants',
        '1 partie sous son minimum 1 participant risque de rester sans table. Voir les parties',
      ]);
      expect(
        lines(summary()).map((line) => [
          line.querySelector('use')?.getAttribute('href'),
          line.classList.contains('danger') ? 'danger' : 'warning',
        ]),
      ).toEqual([
        [expect.stringContaining('octagon-alert'), 'danger'],
        [expect.stringContaining('octagon-alert'), 'danger'],
        [expect.stringContaining('triangle-alert'), 'warning'],
      ]);
    });

    it('choisit le bouton de « presque plein » et de « trop de parties » selon leur code', async () => {
      const { summary } = await render(
        withWarnings([
          { code: 'nearly-full', level: 'warning', title: 'Presque plein', detail: '' },
          { code: 'too-many-games', level: 'warning', title: 'Trop de parties', detail: '' },
        ]),
      );

      expect(lines(summary()).map((line) => text(line.querySelector('button')))).toEqual([
        'Voir la réserve',
        'Voir les parties',
      ]);
    });

    it('n’affiche aucune liste sans avertissement', async () => {
      const { summary } = await render();

      expect(summary()?.querySelector('.warnings')).toBeNull();
    });

    it('mène à l’onglet de chaque bouton, et à la puce « Risquent de ne pas être placés »', async () => {
      const { summary, tabs, panel, settle } = await render(withWarnings(WARNINGS));
      const follow = async (index: number) => {
        lines(summary())[index]!.querySelector('button')!.click();
        await settle();
      };

      await follow(0);
      expect(tabs()[2]!.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabs()[2]);

      await follow(1);
      expect(tabs()[1]!.getAttribute('aria-selected')).toBe('true');
      expect(
        [...panel()!.querySelectorAll('.filters button[aria-pressed="true"]')].map(text),
      ).toEqual(['Risquent de ne pas être placés · 1']);

      await follow(2);
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(tabs()[0]);
    });

    it('mène des participants sans partie à l’onglet Inscrits, sur la puce « Sans partie »', async () => {
      const { summary, tabs, panel, settle } = await render({
        ...TRACKING,
        timeSlots: TRACKING.timeSlots.map((slot) =>
          slot.id === 's2'
            ? {
                ...slot,
                participants: [WITHOUT_GAME, ...PARTICIPANTS],
                warnings: [
                  {
                    code: 'participants-without-game',
                    level: 'danger',
                    title: '1 participant sans partie',
                    detail: '',
                  },
                ],
              }
            : slot,
        ),
      });

      const button = lines(summary())[0]!.querySelector('button')!;
      expect(text(button)).toBe('Voir les participants');
      button.click();
      await settle();

      expect(tabs()[1]!.getAttribute('aria-selected')).toBe('true');
      expect(
        [...panel()!.querySelectorAll('.filters button[aria-pressed="true"]')].map(text),
      ).toEqual(['Sans partie · 1']);
    });

    it('compte les avertissements sur la tuile, avec l’icône du plus grave', async () => {
      const { tiles } = await render(withWarnings(WARNINGS));

      expect(text(tiles()[1]!.querySelector('.warning-count'))).toBe('3 avertissements');
      expect(tiles()[1]!.querySelector('.warning-count use')?.getAttribute('href')).toContain(
        'octagon-alert',
      );
      expect(tiles()[2]!.querySelector('.warning-count')).toBeNull();
    });

    it('compte un seul avertissement jaune, au singulier', async () => {
      const { tiles } = await render(withWarnings([WARNINGS[2]!]));

      expect(text(tiles()[1]!.querySelector('.warning-count'))).toBe('1 avertissement');
      expect(tiles()[1]!.querySelector('.warning-count use')?.getAttribute('href')).toContain(
        'triangle-alert',
      );
    });

    it('remplit en jaune la jauge d’un créneau « presque plein » ou qui a « trop de parties »', async () => {
      const gauges = async (code: 'nearly-full' | 'too-many-games' | 'seats-missing') => {
        const { tiles, summary, fixture } = await render(
          withWarnings([{ code, level: 'warning', title: '', detail: '' }]),
        );
        const shortfalls = [tiles()[1]!, summary()!].map((element) =>
          element.querySelector('app-gauge')!.classList.contains('shortfall'),
        );
        fixture.destroy();
        return shortfalls;
      };

      expect(await gauges('nearly-full')).toEqual([true, true]);
      expect(await gauges('too-many-games')).toEqual([true, true]);
      expect(await gauges('seats-missing')).toEqual([false, false]);
    });
  });

  describe('onglets', () => {
    it('montre les onglets, « Parties du créneau » choisi, avec leur icône et leur compteur', async () => {
      const { tabs, panel } = await render();

      expect(tabs().map(text)).toEqual([
        'Parties du créneau 2',
        'Inscrits du créneau 26',
        'Réserve du créneau 2',
      ]);
      expect(tabs().map((tab) => tab.querySelector('app-icon')?.getAttribute('name'))).toEqual([
        'dices',
        'users',
        'inbox',
      ]);
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(panel()).not.toBeNull();
    });

    it('rend ses panneaux sans violation d’Angular Aria', async () => {
      const warn = vi.spyOn(console, 'warn');
      const error = vi.spyOn(console, 'error');

      await render();

      expect([...warn.mock.calls, ...error.mock.calls].flat().join(' ')).not.toContain(
        'Violations',
      );
    });

    it('change d’onglet au clavier, avec ← →, Début et Fin', async () => {
      const { fixture, tabs } = await render();
      tabs()[0]!.focus();

      for (const [key, selected] of [
        ['ArrowRight', 1],
        ['ArrowLeft', 0],
        ['End', 2],
        ['Home', 0],
      ] as const) {
        document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        fixture.detectChanges();
        expect(document.activeElement).toBe(tabs()[selected]);
        expect(tabs()[selected]!.getAttribute('aria-selected')).toBe('true');
      }
    });

    it('garde l’onglet ouvert d’un créneau à l’autre, avec le compteur du créneau', async () => {
      const { fixture, tiles, tabs, rows } = await render();

      tiles()[2]!.click();
      fixture.detectChanges();

      expect(tabs().map(text)).toEqual([
        'Parties du créneau 0',
        'Inscrits du créneau 0',
        'Réserve du créneau 0',
      ]);
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(rows().map(text)).toEqual([
        'Dragon Table libre Programmer ici…',
        'Licorne Table libre Programmer ici…',
        'Phénix Table libre Programmer ici…',
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
        'Phénix Table libre Programmer ici…',
        'Sphinx N Néons Cthulhu · Kaïros 2 inscrits · 3 à 4 places · 1 manquant double Sous son minimum',
      ]);
    });

    it('distingue la table libre et le second créneau d’une partie double', async () => {
      const { rows } = await render();

      expect(rows()[1]!.classList).toContain('second-slot');
      expect(rows()[2]!.classList).toContain('free');
    });

    it('« Programmer ici… » sur une table libre : dialogue de la case, puis focus sur la partie et annonce', async () => {
      const { rows, tabs, reread } = await render();
      const programmed = game('p4', 'Abysses', 't3', ['s2']);
      const games = [BRUMES, EPICE, NEONS, programmed];
      scheduleOnCell.mockResolvedValue({ games, reserve: [] });

      rows()[2]!.querySelector('button')!.click();
      await reread({ ...TRACKING, games });

      expect(scheduleOnCell).toHaveBeenCalledWith({
        timeSlot: TRACKING.timeSlots[1],
        table: TRACKING.tables[2],
      });
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement?.id).toBe('tracked-game-p4');
      expect(TestBed.inject(Announcer).message()).toBe(
        `Partie «${NBSP}Abysses${NBSP}» programmée${NBSP}: créneau 2, Phénix.`,
      );
    });

    it('relit le suivi quand le dialogue de la case se ferme sans programmer', async () => {
      const { rows, reread, panel } = await render();
      scheduleOnCell.mockResolvedValue(undefined);

      rows()[2]!.querySelector('button')!.click();
      await reread(TRACKING);

      expect(panel()).not.toBeNull();
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
        "8 d'entre eux n'ont pas d'autre inscription sur le créneau : ils restent dans le tirage du créneau, mais sans être inscrits à aucune partie.",
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
  describe('onglet Réserve du créneau', () => {
    /** Ouvre l'onglet « Réserve du créneau ». */
    async function renderReserve(tracking = TRACKING) {
      const rendered = await render(tracking);
      rendered.tabs()[2]!.click();
      await rendered.settle();
      const cards = () => [...(rendered.panel()?.querySelectorAll('li') ?? [])];
      return { ...rendered, cards };
    }

    it('compte les programmables et les autres, puis une carte par scénario, dans l’ordre reçu', async () => {
      const { panel, cards } = await renderReserve();

      expect(text(panel()?.querySelector('p'))).toBe(
        '2 scénarios programmables sur ce créneau, 1 autre en réserve.',
      );
      expect(cards().map((card) => text(card.querySelector('h3')))).toEqual([
        'Abysses',
        'Cendres',
        'Aube',
      ]);
    });

    it('atténue un scénario non programmable, avec la phrase de son motif et sans action', async () => {
      const { cards } = await renderReserve();
      const aube = cards()[2]!;

      expect(aube.querySelector('app-reserve-scenario-card')!.classList).toContain('unschedulable');
      expect(text(aube)).toContain('Toutes les tables sont prises sur le créneau 2.');
      expect(aube.querySelector('button')).toBeNull();
      expect(text(cards()[1]!.querySelector('button'))).toBe('Programmer ici…');
    });

    it('dit qu’un scénario est déjà programmé sur un autre créneau', async () => {
      const { cards } = await renderReserve();

      expect(text(cards()[0])).toContain('Déjà programmé : créneau 1');
      expect(text(cards()[1])).not.toContain('Déjà programmé');
    });

    it('ne cite pas le créneau affiché parmi ceux où le scénario est programmé', async () => {
      // « Cendres », partie double des créneaux 1 et 2 : sur le créneau 2, son MJ est occupé.
      const cendres = reserveScenario('r2', 'Cendres', ['s1', 's2']);
      const { cards } = await renderReserve({ ...TRACKING, reserve: [ABYSSES, AUBE, cendres] });

      expect(text(cards()[1])).toContain('Déjà programmé : créneau 1');
    });

    it('dit qu’un créneau n’a aucun scénario en réserve', async () => {
      const { fixture, tiles, panel } = await renderReserve();

      tiles()[2]!.click();
      fixture.detectChanges();

      expect(text(panel())).toBe('Aucun scénario en réserve sur ce créneau.');
    });

    it('« Programmer ici… » : dialogue limité au créneau, puis onglet Parties, focus sur la partie et annonce', async () => {
      const { cards, tabs, reread } = await renderReserve();
      const programmed = game('p4', 'Abysses', 't3', ['s2'], {
        scenario: { ...game('p4', 'Abysses', 't3', ['s2']).scenario, id: 'r1' },
      });
      const games = [BRUMES, EPICE, NEONS, programmed];
      scheduleOn.mockResolvedValue({ games, reserve: [] });

      cards()[0]!.querySelector('button')!.click();
      await reread({ ...TRACKING, games });

      expect(scheduleOn).toHaveBeenCalledWith({
        scenario: ABYSSES,
        timeSlots: [TRACKING.timeSlots[1]],
        tables: TRACKING.tables,
      });
      expect(tabs()[0]!.getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement?.id).toBe('tracked-game-p4');
      expect(TestBed.inject(Announcer).message()).toBe(
        `Partie «${NBSP}Abysses${NBSP}» programmée${NBSP}: créneau 2, Phénix.`,
      );
    });

    it('relit le suivi quand le dialogue se ferme sans programmer', async () => {
      const { cards, reread, panel } = await renderReserve();
      scheduleOn.mockResolvedValue(undefined);

      cards()[0]!.querySelector('button')!.click();
      await reread(TRACKING);

      expect(panel()).not.toBeNull();
    });
  });

  describe('onglet Inscrits du créneau', () => {
    /** Ouvre l'onglet « Inscrits du créneau ». */
    async function renderParticipants(tracking = TRACKING) {
      const rendered = await render(tracking);
      rendered.tabs()[1]!.click();
      await rendered.settle();
      const chips = () => [...(rendered.panel()?.querySelectorAll('.filters button') ?? [])];
      const table = () => rendered.panel()?.querySelector('table');
      /** Les lignes du tableau, groupes compris : une ligne par rangée de cellules. */
      const tableRows = () =>
        [...(table()?.querySelectorAll('tbody tr') ?? [])].map((row) =>
          [...row.querySelectorAll('th, td')].map(text),
        );
      return { ...rendered, chips, table, tableRows };
    }

    it('montre une puce par filtre, avec son compte, « Tous » choisi', async () => {
      const { chips } = await renderParticipants();

      expect(chips().map(text)).toEqual([
        'Tous · 3',
        'Risquent de ne pas être placés · 1',
        'Risquent de rester sans table · 1',
      ]);
      expect(chips().map((chip) => chip.getAttribute('aria-pressed'))).toEqual([
        'true',
        'false',
        'false',
      ]);
    });

    it('montre un pseudo par ligne, une partie par colonne dans l’ordre des tables, en deux groupes', async () => {
      const { table, tableRows } = await renderParticipants();

      expect([...table()!.querySelectorAll('thead th')].map(text)).toEqual([
        'Pseudo',
        'Brumes 15 inscrits · 3–4 Très demandée',
        'Néons 2 inscrits · 3–4 double Sous son minimum',
        'Avertissement',
      ]);
      expect(tableRows()).toEqual([
        ['Une seule inscription · 2'],
        ['Anna', 'inscrit', '', 'Risque de ne pas être placé'],
        ['Sven', '', 'inscrit', 'Risque de rester sans table'],
        ['Plusieurs inscriptions · 1'],
        ['Lune', 'inscrit', 'inscrit', ''],
      ]);
      expect(table()!.querySelectorAll('tbody th[scope="row"]')).toHaveLength(3);
    });

    it('montre les participants sans partie en premier, avec leur puce, sans coche et avec la pastille rouge « Sans partie »', async () => {
      const { chips, tableRows, table } = await renderParticipants({
        ...TRACKING,
        timeSlots: TRACKING.timeSlots.map((slot) =>
          slot.id === 's2' ? { ...slot, participants: [WITHOUT_GAME, ...PARTICIPANTS] } : slot,
        ),
      });

      expect(chips().map(text)).toEqual([
        'Tous · 4',
        'Sans partie · 1',
        'Risquent de ne pas être placés · 1',
        'Risquent de rester sans table · 1',
      ]);
      expect(tableRows().slice(0, 3)).toEqual([
        ['Sans partie · 1'],
        ['Bastou', '', '', 'Sans partie'],
        ['Une seule inscription · 2'],
      ]);
      expect(table()!.querySelector('.pill')?.querySelector('use')?.getAttribute('href')).toBe(
        'icons.svg#octagon-alert',
      );
      expect(table()!.querySelector('.pill')?.classList.contains('danger')).toBe(true);
    });

    it('marque chaque risque d’une pastille, avec son icône', async () => {
      const { table } = await renderParticipants();

      expect(
        [...table()!.querySelectorAll('.pill')].map((pill) => [
          pill.querySelector('use')?.getAttribute('href'),
          pill.classList.contains('danger') ? 'danger' : 'warning',
        ]),
      ).toEqual([
        ['icons.svg#octagon-alert', 'danger'],
        ['icons.svg#triangle-alert', 'warning'],
      ]);
    });

    it('filtre les pseudos d’après la puce choisie, et cache le groupe vide', async () => {
      const { chips, tableRows, settle } = await renderParticipants();

      (chips()[1] as HTMLButtonElement).click();
      await settle();

      expect(chips()[1]!.getAttribute('aria-pressed')).toBe('true');
      expect(tableRows()).toEqual([
        ['Une seule inscription · 1'],
        ['Anna', 'inscrit', '', 'Risque de ne pas être placé'],
      ]);
    });

    it('n’affiche pas une puce à 0', async () => {
      const { chips } = await renderParticipants({
        ...TRACKING,
        timeSlots: TRACKING.timeSlots.map((slot) =>
          slot.id === 's2' ? { ...slot, participants: PARTICIPANTS.slice(1) } : slot,
        ),
      });

      expect(chips().map(text)).toEqual(['Tous · 2', 'Risquent de rester sans table · 1']);
    });

    it('garde le filtre à la relecture, et revient à « Tous » quand sa puce disparaît', async () => {
      const { chips, tableRows, settle, panel, button, reread } = await renderParticipants();
      moveTo.mockResolvedValue(undefined);
      (chips()[1] as HTMLButtonElement).click();
      await settle();

      // « Déplacer vers… » fermé sans geste relit le suivi.
      panel()!.querySelector<HTMLButtonElement>('thead th button')!.click();
      await settle();
      button('Déplacer vers…')!.click();
      await reread(TRACKING);

      expect(chips()[1]!.getAttribute('aria-pressed')).toBe('true');

      button('Déplacer vers…')!.click();
      await reread({
        ...TRACKING,
        timeSlots: TRACKING.timeSlots.map((slot) =>
          slot.id === 's2' ? { ...slot, participants: PARTICIPANTS.slice(1) } : slot,
        ),
      });

      expect(chips()[0]!.getAttribute('aria-pressed')).toBe('true');
      expect(tableRows()).toHaveLength(4);
    });

    it('ouvre la fiche d’une partie par le titre de sa colonne', async () => {
      const { panel, sheet, settle } = await renderParticipants();
      const title = panel()!.querySelectorAll<HTMLButtonElement>('thead th button')[1]!;

      title.click();
      await settle();

      expect(text(sheet()?.querySelector('h2'))).toBe('Néons');
      expect(title.getAttribute('aria-expanded')).toBe('true');
    });

    it('dit qu’un créneau n’a aucune inscription', async () => {
      const { tiles, panel, settle, table } = await renderParticipants();

      tiles()[2]!.click();
      await settle();

      expect(table()).toBeNull();
      expect(text(panel())).toBe("Aucune inscription sur ce créneau pour l'instant.");
    });
  });

  describe('inscrits dans la fiche de la partie', () => {
    /** La section « Inscrits » de la fiche de la partie, ouverte par son titre. */
    async function renderSheet(gameId: string, tracking = TRACKING) {
      const rendered = await render(tracking);
      rendered.host.querySelector<HTMLButtonElement>(`#tracked-game-${gameId}`)!.click();
      await rendered.settle();
      return { ...rendered, section: () => rendered.sheet()?.querySelector('.sign-ups') };
    }

    it('montre les chiffres de la partie, puis ses pseudos en deux groupes, après les actions', async () => {
      const { sheet, section } = await renderSheet('p1');

      expect(text(section())).toBe(
        'Inscrits 15 inscrits · 3 à 4 places Très demandée ' +
          'dont 8 sans autre inscription sur le créneau ' +
          'Sans autre inscription sur le créneau · 1 Anna Risque de ne pas être placé ' +
          'Inscrits aussi ailleurs sur le créneau · 1 Lune aussi : « Néons »',
      );
      expect(section()!.querySelector('app-gauge')).not.toBeNull();
      const actions = sheet()!.querySelector('.actions')!;
      expect(actions.compareDocumentPosition(section()!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('dit qu’une partie double compte ses inscriptions sur son premier créneau', async () => {
      const { section } = await renderSheet('p3');

      expect(text(section())).toContain(
        'Partie double : ses inscriptions comptent sur le créneau 2.',
      );
    });

    it('dit qu’une partie n’a aucun inscrit', async () => {
      const { section } = await renderSheet('p4', {
        ...TRACKING,
        games: [...TRACKING.games, game('p4', 'Sable', 't3', ['s2'])],
      });

      expect(text(section())).toContain("Aucun inscrit pour l'instant.");
    });

    it('dit qu’un créneau publié a fermé ses inscriptions, sans action', async () => {
      const { section, button, reread } = await renderSheet('p1');
      moveTo.mockResolvedValue(undefined);

      // « Déplacer vers… » fermé sans geste relit le suivi : le tirage est publié entre-temps.
      button('Déplacer vers…')!.click();
      await reread({
        ...TRACKING,
        timeSlots: TRACKING.timeSlots.map((slot) =>
          slot.id === 's2' ? { ...slot, state: 'published' } : slot,
        ),
      });

      expect(text(section())).toContain('Tirage publié : les inscriptions sont fermées.');
      expect(button('Déprogrammer')).toBeUndefined();
    });
  });

  describe('relecture', () => {
    /** L'état de l'onglet du navigateur, lu par la page. */
    let visibility: DocumentVisibilityState;
    /** Le suivi relu : le créneau 2 a gagné deux participants. */
    const LATER: SignUpTrackingDto = {
      ...TRACKING,
      timeSlots: TRACKING.timeSlots.map((slot) =>
        slot.id === 's2' ? { ...slot, demand: 28 } : slot,
      ),
    };

    beforeEach(() => {
      // Seuls l'intervalle et l'heure sont simulés : le reste de la page garde ses minuteries.
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      vi.setSystemTime(new Date(2027, 2, 14, 14, 5));
      visibility = 'visible';
      vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    /** L'onglet du navigateur se cache, ou redevient visible. */
    const show = (state: DocumentVisibilityState) => {
      visibility = state;
      document.dispatchEvent(new Event('visibilitychange'));
    };
    const reads = (http: HttpTestingController) => {
      TestBed.tick();
      return http.match(apiUrl(signUpTrackingEndpoints.read));
    };
    /** La lecture en attente échoue : pas de réseau, ou redéploiement. */
    const fail = async (http: HttpTestingController) => {
      TestBed.tick();
      http
        .expectOne(apiUrl(signUpTrackingEndpoints.read))
        .flush(null, { status: 502, statusText: 'Bad Gateway' });
      await new Promise((resolve) => setTimeout(resolve));
    };
    const ageLine = (host: HTMLElement) =>
      host.querySelector<HTMLButtonElement>('.freshness button');

    it('relit le suivi toutes les 30 s quand l’onglet est visible', async () => {
      const { http, tiles, reread } = await render();

      vi.advanceTimersByTime(29_999);
      expect(reads(http)).toHaveLength(0);
      vi.advanceTimersByTime(1);
      await reread(LATER);

      expect(text(tiles()[1])).toContain('28 / 22');
    });

    it('ne relit rien quand l’onglet est caché, puis relit à son retour', async () => {
      const { http, tiles, reread } = await render();

      show('hidden');
      vi.advanceTimersByTime(90_000);
      expect(reads(http)).toHaveLength(0);

      show('visible');
      await reread(LATER);

      expect(text(tiles()[1])).toContain('28 / 22');
    });

    it('relit sans barre de progression, en gardant le créneau, l’onglet et la fiche', async () => {
      const { fixture, host, http, tiles, tabs, sheet, settle } = await render();
      host.querySelector<HTMLButtonElement>('#tracked-game-p1')!.click();
      await settle();
      tabs()[1]!.click();
      fixture.detectChanges();

      vi.advanceTimersByTime(30_000);
      TestBed.tick();
      // Au-delà du délai de la barre de progression d'une lecture lente.
      await new Promise((resolve) => setTimeout(resolve, 350));
      fixture.detectChanges();
      expect(host.querySelector('[role="progressbar"]')).toBeNull();
      expect(host.querySelector('app-loadable')!.getAttribute('aria-busy')).toBe('false');
      http.expectOne(apiUrl(signUpTrackingEndpoints.read)).flush(LATER);
      await settle();

      expect(tiles()[1]!.getAttribute('aria-pressed')).toBe('true');
      expect(tabs()[1]!.getAttribute('aria-selected')).toBe('true');
      expect(text(sheet()?.querySelector('h2'))).toContain('Brumes');
    });

    it('garde les derniers chiffres quand une lecture échoue, sans ligne d’âge avant 2 minutes', async () => {
      const { fixture, host, http, tiles } = await render();

      for (let reread = 0; reread < 4; reread++) {
        vi.advanceTimersByTime(30_000);
        await fail(http);
      }
      fixture.detectChanges();

      expect(text(tiles()[1])).toContain('26 / 22');
      expect(text(host)).not.toContain('Impossible de charger le suivi');
      expect(ageLine(host)).toBeNull();
    });

    it('dit de quand datent les chiffres au-delà de 2 minutes sans lecture réussie', async () => {
      const { fixture, host, http } = await render();

      for (let reread = 0; reread < 5; reread++) {
        vi.advanceTimersByTime(30_000);
        await fail(http);
      }
      fixture.detectChanges();

      expect(text(ageLine(host))).toBe('Pas de connexion · à jour à 14 h 05');
    });

    it('relance la lecture d’un clic sur la ligne d’âge, qui disparaît une fois les chiffres relus', async () => {
      const { fixture, host, http, tiles, reread } = await render();
      for (let attempt = 0; attempt < 5; attempt++) {
        vi.advanceTimersByTime(30_000);
        await fail(http);
      }
      fixture.detectChanges();

      ageLine(host)!.click();
      await reread(LATER);

      expect(text(tiles()[1])).toContain('28 / 22');
      expect(ageLine(host)).toBeNull();
    });

    it('ne montre pas la ligne d’âge pendant la relecture du retour sur l’onglet', async () => {
      const { host, reread } = await render();
      show('hidden');
      vi.advanceTimersByTime(180_000);

      show('visible');
      TestBed.tick();
      expect(ageLine(host)).toBeNull();

      // La relecture du retour, servie ici, prouve qu'elle est partie.
      await reread(LATER);
      expect(ageLine(host)).toBeNull();
    });

    it('relit encore après un geste fait pendant une lecture qui suit un échec', async () => {
      const { http, rows, tiles, reread } = await render();
      scheduleOnCell.mockResolvedValue(undefined);
      vi.advanceTimersByTime(30_000);
      await fail(http);
      vi.advanceTimersByTime(30_000);
      TestBed.tick();

      // Le geste finit pendant cette lecture, partie avant lui : « Programmer ici… », fermé.
      rows()[2]!.querySelector('button')!.click();
      await new Promise((resolve) => setTimeout(resolve));
      http.expectOne(apiUrl(signUpTrackingEndpoints.read)).flush(TRACKING);
      await reread(LATER);

      expect(text(tiles()[1])).toContain('28 / 22');
    });

    it('ne ferme pas un dialogue ouvert', async () => {
      const { askUnschedule, dialog, reread } = await render();
      await askUnschedule([{ gameId: 'p1', signUpCount: 15, withoutOtherSignUpCount: 8 }]);

      vi.advanceTimersByTime(30_000);
      await reread(LATER);

      expect(dialog()).not.toBeNull();
    });

    /** Le suivi relu, où « Brumes » a ces chiffres. */
    const withBrumes = (figures: Partial<TrackedGameDto>): SignUpTrackingDto => ({
      ...TRACKING,
      games: [{ ...BRUMES, ...figures }, EPICE, NEONS],
    });

    it('reprend dans le dialogue ouvert les chiffres relus de la partie', async () => {
      const { askUnschedule, dialog, reread } = await render();
      await askUnschedule([{ gameId: 'p1', signUpCount: 15, withoutOtherSignUpCount: 8 }]);

      vi.advanceTimersByTime(30_000);
      await reread(withBrumes({ signUpCount: 12, withoutOtherSignUpCount: 1 }));

      expect([...dialog()!.querySelectorAll('h2, p')].map(text)).toEqual([
        'Déprogrammer « Brumes » du créneau 2 ?',
        'Il y a 12 inscrits à la partie. Ils perdront leur inscription et seront notifiés.',
        "1 d'entre eux n'a pas d'autre inscription sur le créneau : il reste dans le tirage du créneau, mais sans être inscrit à aucune partie.",
        'Le scénario revient en réserve, sans ses inscriptions.',
      ]);
    });

    it('dit dans le dialogue ouvert qu’aucun inscrit ne perd son inscription quand leur nombre retombe à 0', async () => {
      const { askUnschedule, dialog, reread } = await render();
      await askUnschedule([{ gameId: 'p1', signUpCount: 15, withoutOtherSignUpCount: 8 }]);

      vi.advanceTimersByTime(30_000);
      await reread(withBrumes({ signUpCount: 0, withoutOtherSignUpCount: 0 }));

      expect([...dialog()!.querySelectorAll('h2, p')].map(text)).toEqual([
        'Déprogrammer « Brumes » du créneau 2 ?',
        'Aucun inscrit ne perd son inscription.',
        'Le scénario revient en réserve, sans ses inscriptions.',
      ]);
    });

    it('donne au dialogue « Déplacer vers… » les chiffres relus de chaque partie', async () => {
      const { host, settle, button, reread } = await render();
      moveTo.mockReturnValue(new Promise(() => {}));
      host.querySelector<HTMLButtonElement>('#tracked-game-p1')!.click();
      await settle();
      button('Déplacer vers…')!.click();
      await settle();
      const { currentSignUpFigures } = moveTo.mock.calls[0]![0];

      vi.advanceTimersByTime(30_000);
      await reread(withBrumes({ signUpCount: 12, withoutOtherSignUpCount: 1 }));

      expect(currentSignUpFigures?.('p1')).toMatchObject({
        signUpCount: 12,
        withoutOtherSignUpCount: 1,
      });
      expect(currentSignUpFigures?.('p3')).toMatchObject({
        signUpCount: 2,
        withoutOtherSignUpCount: 0,
      });
    });
  });
});
