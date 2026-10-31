import {
  ApplicationRef,
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import {
  frontOfficeEndpoints,
  signUpEndpoints,
  type FrontOfficeGameDto,
  type FrontOfficeScheduleDto,
  type FrontOfficeTimeSlotDto,
  type ParticipantSituationDto,
  type TimeSlotStateDto,
} from '@chimeres/contract';
import { formatDayAndMonth, formatTimeOfDay, fr } from '@chimeres/design';
import { injectApiCall, injectApiRead } from '../api-call';
import { timeSlotsOf } from '../game/game-text';
import { LinkedPhone } from '../linked-phone';
import { readProblem, type Problem } from '../problem';
import { Alerts } from '../shell/alerts';
import { PageVisibility } from './page-visibility';
import { PhoneClock } from './phone-clock';

/** Relecture tant que la page est visible (ADR 0011). */
const REREAD_EVERY_MS = 30_000;
/** Au-delà, la ligne d'âge dit de quand date la donnée (§6, Fraîcheur). */
const STALE_AFTER_MS = 2 * 60_000;
/** Au-delà, un geste sans réponse dit de vérifier, puis relit (§6). */
const GESTURE_TIMEOUT_MS = 10_000;
const SLOW_NETWORK = fr`Le réseau ne répond pas : vérifie ton inscription.`;

/**
 * Ce que la barre du bas de la fiche montre pour une partie (§5.3) : le geste, quand les
 * inscriptions de son créneau sont ouvertes, ou pourquoi il est impossible.
 * - `open` : « S'inscrire », ou « Inscription enregistrée » et « Se désinscrire » ; `pending`
 *   pendant l'envoi ;
 * - `own-game` : « Tu mènes cette partie », avec Mes parties sur son créneau `rank` (§5.7) ;
 * - `leading` : le MJ du pseudo mène `game` sur l'un des créneaux de celle-ci (IN-4) ;
 * - `held` : le pseudo joue à `game`, partie double publiée qui occupe un créneau de celle-ci ;
 * - `drawing` : « Tirage en cours » sur le créneau `rank` ;
 * - après la publication : `assigned-here` (« Tu joues à cette table »), `assigned-elsewhere` (sa
 *   table sur ce créneau), `unassigned` (« Pas de place pour toi »), `closed` (sans inscription).
 */
export type SignUpBarState =
  | { kind: 'open'; signedUp: boolean; pending: boolean }
  | { kind: 'own-game'; rank: number }
  | { kind: 'leading'; game: FrontOfficeGameDto }
  | { kind: 'held'; game: FrontOfficeGameDto; signedUp: boolean }
  | { kind: 'drawing'; rank: number; signedUp: boolean }
  | { kind: 'assigned-here' }
  | { kind: 'assigned-elsewhere'; game: FrontOfficeGameDto }
  | { kind: 'unassigned' }
  | { kind: 'closed'; rank: number };

/**
 * La partie que mène le MJ du pseudo sur un créneau (§5.7), et `started` depuis son début, pour
 * « Maintenant ». Où en est le tirage de son premier créneau : inscriptions ouvertes, tirage en
 * cours (sans résultat provisoire), ses joueurs publiés, ou sa partie annulée (TI-6), avec les
 * parties du créneau où il reste de la place.
 */
export type LedGame = {
  game: FrontOfficeGameDto;
  started: boolean;
  outcome:
    | { kind: 'sign-ups-open' }
    | { kind: 'drawing' }
    | { kind: 'players'; players: string[] }
    | { kind: 'cancelled'; gamesWithSeats: FrontOfficeGameDto[] };
};

/** Un créneau à venir de Mes parties. */
export type MyTimeSlot = {
  timeSlot: FrontOfficeTimeSlotDto;
  /** Inscriptions ouvertes, tirage lancé, ou tirage publié. */
  state: TimeSlotStateDto;
  /** Les inscriptions du pseudo dont c'est le premier créneau : une partie double est sous son premier (IN-3). */
  signedUpGames: FrontOfficeGameDto[];
  /**
   * Son affectation, après la publication : la partie où il joue, une partie double publiée comprise
   * sur son second créneau (TI-3), ou pas de place, avec les parties du créneau où il en reste ;
   * `null` avant.
   */
  assignment:
    | { kind: 'assigned'; game: FrontOfficeGameDto }
    | { kind: 'unassigned'; gamesWithSeats: FrontOfficeGameDto[] }
    | null;
  /**
   * Le rappel d'IN-5, tant que les inscriptions du créneau sont ouvertes : sa seule inscription est
   * une partie très demandée. Une partie double ne compte que sur son premier créneau, et celle où
   * il joue retire le rappel de son second (TI-3).
   */
  onlySignUpOversubscribed: boolean;
  /** La partie qu'y mène son MJ, sur ses deux créneaux pour une partie double, ou `null`. */
  led: LedGame | null;
};

/**
 * La carte en tête de l'Accueil :
 * - `assigned` : la dernière affectation publiée, tant que sa partie n'est pas terminée, sur ses
 *   créneaux (deux pour une partie double) ; `started` depuis son début, pour « Maintenant » (story 54) ;
 * - `unassigned` : « Pas de place pour toi », si c'est la dernière publiée, avec les parties du
 *   créneau où il reste de la place (story 55) ;
 * - `leading` : « Tu mènes à la table *T* », si le dernier tirage publié est celui de sa partie,
 *   sur ses créneaux (story 56) ; `cancelled` : sa partie annulée (TI-6) ;
 * - `drawing` : sinon, « Tirage en cours » sur le premier créneau en cours de tirage où il est
 *   inscrit (story 57), ou `leading-drawing` s'il y mène (story 58) ;
 * - `choose-games` : sans affectation à montrer, « Choisis tes parties » (story 59).
 */
export type HomeCard =
  | {
      kind: 'assigned';
      game: FrontOfficeGameDto;
      timeSlots: FrontOfficeTimeSlotDto[];
      started: boolean;
    }
  | { kind: 'unassigned'; timeSlot: FrontOfficeTimeSlotDto; gamesWithSeats: FrontOfficeGameDto[] }
  | { kind: 'leading'; led: LedGame; timeSlots: FrontOfficeTimeSlotDto[] }
  | { kind: 'cancelled'; timeSlot: FrontOfficeTimeSlotDto; led: LedGame }
  | { kind: 'leading-drawing'; timeSlot: FrontOfficeTimeSlotDto; led: LedGame }
  | { kind: 'drawing'; timeSlot: FrontOfficeTimeSlotDto; signedUpGames: FrontOfficeGameDto[] }
  | { kind: 'choose-games' };

/** L'Accueil : sa carte, puis « Ton programme », une ligne par créneau à venir (story 60). */
export type Home = { card: HomeCard; timeSlots: MyTimeSlot[] };

/**
 * Le seul module du front office qui lit et garde les données du participant (ADR 0011). Les écrans
 * lisent ses signaux, et n'appellent jamais l'API pour ces données. Il relit à l'ouverture, à chaque
 * écran, au retour au premier plan, et toutes les 30 s tant que la page est visible ; une lecture
 * qui échoue garde la dernière valeur. Fourni par la coquille : il part avec elle, et sa copie avec.
 */
@Injectable()
export class ParticipantData {
  private readonly apiRead = injectApiRead();
  private readonly apiCall = injectApiCall();
  private readonly alerts = inject(Alerts);
  private readonly clock = inject(PhoneClock);
  private readonly visibility = inject(PageVisibility);
  private readonly linkedPhone = inject(LinkedPhone);

  /** La dernière lecture réussie. */
  private readonly lastRead = signal<FrontOfficeScheduleDto | undefined>(undefined);
  private readonly lastSituation = signal<ParticipantSituationDto | undefined>(undefined);
  /** Les parties dont un geste est en cours d'envoi. */
  private readonly pending = signal<ReadonlySet<string>>(new Set());
  /**
   * L'heure de cette lecture par le serveur : son en-tête `Date`, que le cache du service worker
   * garde. Une copie servie hors ligne garde donc son âge (ADR 0011).
   */
  private readonly readAt = signal<Date | undefined>(undefined);
  /** L'heure du téléphone, relevée à chaque relecture, réussie ou non. */
  private readonly now = signal(this.clock.now());
  /** Le serveur a refusé une lecture : la convention est terminée. */
  private readonly refusedAsEnded = signal(false);
  /** La lecture en cours : une autre, demandée pendant qu'elle court, s'y joint. */
  private currentRead: Promise<void> | null = null;

  /**
   * Le programme sans les créneaux terminés, selon l'heure du téléphone, même hors ligne (story 53),
   * ni les parties dont le premier créneau est terminé : une partie double commencée ne prend plus
   * d'inscription. `undefined` avant la première lecture réussie.
   */
  readonly schedule = computed<FrontOfficeScheduleDto | undefined>(() => {
    const schedule = this.lastRead();
    if (!schedule) return undefined;
    const now = this.now();
    const timeSlots = schedule.timeSlots.filter(
      (slot) => !schedule.date || !isPast(schedule.date, slot.end, now),
    );
    const remaining = new Set(timeSlots.map(({ id }) => id));
    return {
      ...schedule,
      timeSlots,
      games: schedule.games.filter((game) => remaining.has(game.timeSlotIds[0]!)),
    };
  });

  /**
   * « Pas de connexion · à jour à 14 h 05 », ou « … le 26 octobre à 18 h 05 » un autre jour, quand
   * la donnée a plus de 2 minutes ; `null` sinon.
   */
  readonly ageLine = computed<string | null>(() => {
    const readAt = this.readAt();
    const now = this.now();
    if (!readAt || now.getTime() - readAt.getTime() <= STALE_AFTER_MS) return null;
    const time = formatTimeOfDay(readAt);
    return readAt.toDateString() === now.toDateString()
      ? `Pas de connexion · à jour à ${time}`
      : `Pas de connexion · à jour le ${formatDayAndMonth(readAt)} à ${time}`;
  });

  /**
   * La convention est terminée : à la fin de son dernier créneau selon l'heure du téléphone, même
   * hors ligne, ou quand le serveur le dit. Sans date ni créneau, elle ne se termine pas.
   */
  readonly ended = computed(() => {
    if (this.refusedAsEnded()) return true;
    const end = this.lastRead()?.end;
    return !!end && isPast(end.date, end.time, this.now());
  });

  /** La situation du pseudo : ses inscriptions, et l'état de chaque créneau pour lui. */
  readonly situation = this.lastSituation.asReadonly();

  /** Mes parties : les créneaux à venir, et pour chacun ce qu'il est pour le pseudo. `undefined` sans données. */
  readonly myTimeSlots = computed<MyTimeSlot[] | undefined>(() => {
    const schedule = this.schedule();
    const situation = this.lastSituation();
    // Une partie double commencée reste l'affectation de son second créneau.
    const fullSchedule = this.lastRead();
    if (!schedule || !situation || !fullSchedule) return undefined;
    return schedule.timeSlots.map((timeSlot) => {
      const signedUpGames = schedule.games.filter(
        (game) =>
          game.timeSlotIds[0] === timeSlot.id && situation.signedUpGameIds.includes(game.id),
      );
      const state = timeSlotSituationOf(situation, timeSlot.id)?.state ?? 'sign-ups-open';
      const assignment = assignmentOf(timeSlot.id, fullSchedule, situation);
      const led = ledGameOf(timeSlot.id, fullSchedule, situation, this.now());
      return {
        timeSlot,
        state,
        signedUpGames,
        assignment,
        // Une partie double où il joue occupe le créneau : ses inscriptions y sont ignorées (TI-3).
        onlySignUpOversubscribed:
          !assignment &&
          state === 'sign-ups-open' &&
          signedUpGames.length === 1 &&
          signedUpGames[0]!.oversubscribed,
        led,
      };
    });
  });

  /** L'Accueil, ou `undefined` sans données. */
  readonly home = computed<Home | undefined>(() => {
    const myTimeSlots = this.myTimeSlots();
    const schedule = this.lastRead();
    const situation = this.lastSituation();
    if (!myTimeSlots || !schedule || !situation) return undefined;
    const card = homeCardOf(myTimeSlots, schedule, situation, this.now());
    // Les créneaux de la carte ne se répètent pas dessous.
    const shown =
      card.kind === 'assigned' || card.kind === 'leading'
        ? card.timeSlots.map(({ id }) => id)
        : card.kind === 'choose-games'
          ? []
          : [card.timeSlot.id];
    return {
      card,
      timeSlots: myTimeSlots.filter(({ timeSlot }) => !shown.includes(timeSlot.id)),
    };
  });

  /**
   * La partie que mène le MJ du pseudo sur ce créneau, sur les deux d'une partie double, ou `null` :
   * il ne peut pas s'y inscrire (IN-4). Une partie annulée ne compte plus (TI-6).
   */
  ledGameOn(timeSlotId: string): FrontOfficeGameDto | null {
    const schedule = this.lastRead();
    const situation = this.lastSituation();
    if (!schedule || !situation) return null;
    return uncancelledGameLedOn(timeSlotId, schedule, situation);
  }

  /** Le MJ du pseudo mène cette partie, même annulée (§5.7). */
  leads(gameId: string): boolean {
    return this.signUpBarOf(gameId)?.kind === 'own-game';
  }

  /** Le pseudo est inscrit à la partie. */
  isSignedUp(gameId: string): boolean {
    return !!this.lastSituation()?.signedUpGameIds.includes(gameId);
  }

  /**
   * La barre du bas de la fiche de la partie, ou `null` sans données ou hors du programme. Une
   * partie double se tire avec son premier créneau (TI-3).
   */
  signUpBarOf(gameId: string): SignUpBarState | null {
    const schedule = this.lastRead();
    const situation = this.lastSituation();
    const game = schedule?.games.find(({ id }) => id === gameId);
    if (!schedule || !situation || !game) return null;
    const signedUp = situation.signedUpGameIds.includes(game.id);
    const gameById = (id: string) => schedule.games.find((candidate) => candidate.id === id);
    if (gameLedOn(game.timeSlotIds[0]!, schedule, situation)?.id === game.id) {
      return { kind: 'own-game', rank: rankOf(schedule, game.timeSlotIds[0]!) };
    }
    const leading = game.timeSlotIds
      .map((id) => uncancelledGameLedOn(id, schedule, situation))
      .find((ledGame) => ledGame);
    if (leading) return { kind: 'leading', game: leading };
    const held = assignedDoubleGames(schedule, situation).find(
      (assigned) =>
        assigned.id !== game.id && assigned.timeSlotIds.some((id) => game.timeSlotIds.includes(id)),
    );
    if (held) return { kind: 'held', game: held, signedUp };
    const firstTimeSlotId = game.timeSlotIds[0]!;
    const rank = rankOf(schedule, firstTimeSlotId);
    const slot = timeSlotSituationOf(situation, firstTimeSlotId);
    if (slot?.state === 'drawing') return { kind: 'drawing', rank, signedUp };
    if (slot?.state === 'published') {
      const result = slot.drawResult;
      if (result?.kind === 'unassigned') return { kind: 'unassigned' };
      if (result?.kind === 'assigned' && result.gameId === game.id)
        return { kind: 'assigned-here' };
      const assigned = result?.kind === 'assigned' ? gameById(result.gameId) : undefined;
      return assigned ? { kind: 'assigned-elsewhere', game: assigned } : { kind: 'closed', rank };
    }
    return { kind: 'open', signedUp, pending: this.pending().has(game.id) };
  }

  /** S'inscrire à la partie (IN-2). */
  signUp(gameId: string): Promise<void> {
    return this.sendGesture(gameId, () =>
      this.apiCall(signUpEndpoints.signUp, { params: { gameId } }),
    );
  }

  /** Se désinscrire de la partie (IN-2), d'un tap, sans confirmation. */
  withdraw(gameId: string): Promise<void> {
    return this.sendGesture(gameId, () =>
      this.apiCall(signUpEndpoints.withdraw, { params: { gameId } }),
    );
  }

  constructor() {
    void this.reread();
    this.rereadOnEachScreen();
    this.rereadInForeground();
  }

  /** Relit le programme et la situation. Une lecture déjà en cours suffit. */
  reread(): Promise<void> {
    this.now.set(this.clock.now());
    this.currentRead ??= this.read().finally(() => (this.currentRead = null));
    return this.currentRead;
  }

  private async read(): Promise<void> {
    try {
      const [{ body, servedAt }, situation] = await Promise.all([
        this.apiRead(frontOfficeEndpoints.readSchedule),
        this.apiRead(frontOfficeEndpoints.readSituation),
      ]);
      this.lastRead.set(body);
      this.lastSituation.set(situation.body);
      this.readAt.set(servedAt ?? this.clock.now());
    } catch (error) {
      // Sinon, la dernière valeur reste à l'écran (502 pendant un redéploiement, pas de réseau).
      this.followRefusal(readProblem(error));
    }
  }

  /** Le serveur ferme l'application, ou ne connaît plus le lien de ce téléphone. */
  private followRefusal({ code }: Problem): void {
    if (code === 'convention-ended') this.refusedAsEnded.set(true);
    if (code === 'phone-not-linked') this.linkedPhone.unlinkedByServer();
  }

  /**
   * Envoie un geste sur la partie, un seul à la fois : un second tap pendant l'envoi est sans
   * effet. Un échec le dit en alerte, et après 10 s sans réponse, l'alerte dit de vérifier (§6).
   * Dans tous les cas, le module relit ensuite : le compteur et l'inscription changent aussitôt.
   */
  private async sendGesture(gameId: string, send: () => Promise<unknown>): Promise<void> {
    if (this.pending().has(gameId)) return;
    this.pending.update((pending) => new Set(pending).add(gameId));
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timedOut = new Promise<'timed-out'>((resolve) => {
        timer = setTimeout(() => resolve('timed-out'), GESTURE_TIMEOUT_MS);
      });
      const sent = send();
      if ((await Promise.race([sent, timedOut])) === 'timed-out') {
        this.alerts.error({ title: SLOW_NETWORK });
        // La réponse finira peut-être par arriver : la relecture la montrera.
        void sent.catch(() => undefined).then(() => this.reread());
      }
    } catch (error) {
      const problem = readProblem(error);
      this.followRefusal(problem);
      if (problem.alert) this.alerts.error(problem.alert);
    } finally {
      clearTimeout(timer);
    }
    // Une lecture partie avant le geste ne le montre peut-être pas : celle-ci part après.
    await this.currentRead;
    await this.reread();
    this.pending.update((pending) => {
      const next = new Set(pending);
      next.delete(gameId);
      return next;
    });
  }

  private rereadOnEachScreen(): void {
    inject(Router)
      .events.pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => void this.reread());
  }

  /**
   * Au retour au premier plan, puis toutes les 30 s tant que la page est visible. La minuterie
   * attend que l'application soit stable, sinon elle retarderait l'enregistrement du service worker.
   */
  private rereadInForeground(): void {
    let wasVisible = this.visibility.visible();
    effect(() => {
      const visible = this.visibility.visible();
      if (visible && !wasVisible) void this.reread();
      wasVisible = visible;
    });
    const destroyRef = inject(DestroyRef);
    let timer: ReturnType<typeof setInterval> | undefined;
    void inject(ApplicationRef)
      .whenStable()
      .then(() => {
        if (destroyRef.destroyed) return;
        timer = setInterval(() => {
          if (this.visibility.visible()) void this.reread();
        }, REREAD_EVERY_MS);
      });
    destroyRef.onDestroy(() => clearInterval(timer));
  }
}

/** Les parties doubles publiées où le pseudo joue. */
function assignedDoubleGames(
  schedule: FrontOfficeScheduleDto,
  situation: ParticipantSituationDto,
): FrontOfficeGameDto[] {
  return situation.timeSlots.flatMap(({ state, drawResult }) => {
    if (state !== 'published' || drawResult?.kind !== 'assigned') return [];
    const game = schedule.games.find(({ id }) => id === drawResult.gameId);
    return game && game.timeSlotIds.length > 1 ? [game] : [];
  });
}

/** L'état du créneau pour le pseudo, et le résultat de son tirage. */
function timeSlotSituationOf(situation: ParticipantSituationDto, timeSlotId: string) {
  return situation.timeSlots.find((slot) => slot.timeSlotId === timeSlotId);
}

/** L'affectation publiée du pseudo sur le créneau, ou la partie double publiée qui l'occupe. */
function assignmentOf(
  timeSlotId: string,
  schedule: FrontOfficeScheduleDto,
  situation: ParticipantSituationDto,
): MyTimeSlot['assignment'] {
  const held = assignedDoubleGames(schedule, situation).find((game) =>
    game.timeSlotIds.includes(timeSlotId),
  );
  if (held) return { kind: 'assigned', game: held };
  const slot = timeSlotSituationOf(situation, timeSlotId);
  if (slot?.state !== 'published') return null;
  const result = slot.drawResult;
  if (result?.kind === 'unassigned') {
    return { kind: 'unassigned', gamesWithSeats: gamesWithSeatsOn(timeSlotId, schedule) };
  }
  const game = result?.kind === 'assigned' && schedule.games.find(({ id }) => id === result.gameId);
  return game ? { kind: 'assigned', game } : null;
}

/** Les parties qui commencent sur ce créneau publié, où il reste de la place. */
function gamesWithSeatsOn(timeSlotId: string, schedule: FrontOfficeScheduleDto) {
  return schedule.games.filter(
    ({ timeSlotIds, playerCount, seats }) =>
      timeSlotIds[0] === timeSlotId && playerCount !== null && playerCount < seats.max,
  );
}

/** Le rang du créneau dans la journée. */
function rankOf(schedule: FrontOfficeScheduleDto, timeSlotId: string): number {
  return schedule.timeSlots.find(({ id }) => id === timeSlotId)?.rank ?? 0;
}

/** La partie que mène le MJ du pseudo sur ce créneau, dans le programme complet, ou `null`. */
function gameLedOn(
  timeSlotId: string,
  schedule: FrontOfficeScheduleDto,
  situation: ParticipantSituationDto,
): FrontOfficeGameDto | null {
  const gameId = timeSlotSituationOf(situation, timeSlotId)?.ledGameId;
  return schedule.games.find(({ id }) => id === gameId) ?? null;
}

/** Comme `gameLedOn()`, sauf une partie annulée : elle ne retient plus son MJ (TI-6). */
function uncancelledGameLedOn(
  timeSlotId: string,
  schedule: FrontOfficeScheduleDto,
  situation: ParticipantSituationDto,
): FrontOfficeGameDto | null {
  const game = gameLedOn(timeSlotId, schedule, situation);
  const first = game && timeSlotSituationOf(situation, game.timeSlotIds[0]!);
  return first?.drawResult?.kind === 'cancelled' ? null : game;
}

/** La partie que mène le MJ du pseudo sur ce créneau, et où en est son tirage (voir `LedGame`). */
function ledGameOf(
  timeSlotId: string,
  schedule: FrontOfficeScheduleDto,
  situation: ParticipantSituationDto,
  now: Date,
): LedGame | null {
  const game = gameLedOn(timeSlotId, schedule, situation);
  if (!game) return null;
  const firstTimeSlotId = game.timeSlotIds[0]!;
  const first = timeSlotSituationOf(situation, firstTimeSlotId);
  const result = first?.drawResult;
  const outcome: LedGame['outcome'] =
    result?.kind === 'leading'
      ? { kind: 'players', players: result.players }
      : result?.kind === 'cancelled'
        ? { kind: 'cancelled', gamesWithSeats: gamesWithSeatsOn(firstTimeSlotId, schedule) }
        : first?.state === 'drawing'
          ? { kind: 'drawing' }
          : // Publié sans résultat pour lui : aucun joueur.
            first?.state === 'published'
            ? { kind: 'players', players: [] }
            : { kind: 'sign-ups-open' };
  const start = timeSlotsOf(schedule, game)[0]!.start;
  return { game, started: !!schedule.date && isPast(schedule.date, start, now), outcome };
}

/** La carte de l'Accueil (voir `HomeCard`). */
function homeCardOf(
  myTimeSlots: MyTimeSlot[],
  schedule: FrontOfficeScheduleDto,
  situation: ParticipantSituationDto,
  now: Date,
): HomeCard {
  const lastPublished = situation.timeSlots
    .filter(({ state, drawResult }) => state === 'published' && drawResult)
    .at(-1);
  const lastResult = lastPublished?.drawResult;
  if (lastResult?.kind === 'leading' || lastResult?.kind === 'cancelled') {
    // Ses créneaux à venir la montrent encore : une partie double reste sur son second créneau.
    const slot = myTimeSlots.find(
      ({ led }) => led?.game.timeSlotIds[0] === lastPublished!.timeSlotId,
    );
    if (slot?.led) {
      return lastResult.kind === 'leading'
        ? { kind: 'leading', led: slot.led, timeSlots: timeSlotsOf(schedule, slot.led.game) }
        : { kind: 'cancelled', timeSlot: slot.timeSlot, led: slot.led };
    }
  }
  if (lastResult?.kind === 'unassigned') {
    const slot = myTimeSlots.find(({ timeSlot }) => timeSlot.id === lastPublished!.timeSlotId);
    if (slot?.assignment?.kind === 'unassigned') {
      return {
        kind: 'unassigned',
        timeSlot: slot.timeSlot,
        gamesWithSeats: slot.assignment.gamesWithSeats,
      };
    }
  }
  if (lastResult?.kind === 'assigned') {
    // Les créneaux à venir la montrent encore : une partie double reste sur son second créneau.
    const assignment = myTimeSlots
      .map((slot) => slot.assignment)
      .find(
        (candidate) => candidate?.kind === 'assigned' && candidate.game.id === lastResult.gameId,
      );
    if (assignment?.kind === 'assigned') {
      const { game } = assignment;
      const timeSlots = timeSlotsOf(schedule, game);
      const started = !!schedule.date && isPast(schedule.date, timeSlots[0]!.start, now);
      return { kind: 'assigned', game, timeSlots, started };
    }
  }
  const drawing = myTimeSlots.find(({ state, signedUpGames, led }) =>
    led ? led.outcome.kind === 'drawing' : state === 'drawing' && signedUpGames.length,
  );
  if (drawing?.led)
    return { kind: 'leading-drawing', timeSlot: drawing.timeSlot, led: drawing.led };
  if (drawing) {
    return { kind: 'drawing', timeSlot: drawing.timeSlot, signedUpGames: drawing.signedUpGames };
  }
  return { kind: 'choose-games' };
}

/** `time` (`HH:MM`), le jour `date` (`AAAA-MM-JJ`), est-il passé ? */
function isPast(date: string, time: string, now: Date): boolean {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  // L'heure locale du téléphone, qui est sur place, à l'heure de Paris.
  return now >= new Date(year, month - 1, day, hours, minutes);
}
