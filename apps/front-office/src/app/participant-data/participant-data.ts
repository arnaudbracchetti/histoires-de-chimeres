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
  type ParticipantSituationDto,
} from '@chimeres/contract';
import { formatDayAndMonth, formatTimeOfDay, fr } from '@chimeres/design';
import { injectApiCall, injectApiRead } from '../api-call';
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
 * - `held` : le pseudo joue à `game`, partie double publiée qui occupe un créneau de celle-ci ;
 * - `drawing` : « Tirage en cours » sur le créneau `rank` ;
 * - après la publication : `assigned-here` (« Tu joues à cette table »), `assigned-elsewhere` (sa
 *   table sur ce créneau), `unassigned` (« Pas de place pour toi »), `closed` (sans inscription).
 */
export type SignUpBarState =
  | { kind: 'open'; signedUp: boolean; pending: boolean }
  | { kind: 'held'; game: FrontOfficeGameDto; signedUp: boolean }
  | { kind: 'drawing'; rank: number; signedUp: boolean }
  | { kind: 'assigned-here' }
  | { kind: 'assigned-elsewhere'; game: FrontOfficeGameDto }
  | { kind: 'unassigned' }
  | { kind: 'closed'; rank: number };

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
    const slotOf = (timeSlotId: string) =>
      situation.timeSlots.find((slot) => slot.timeSlotId === timeSlotId);
    const held = situation.timeSlots
      .map(({ state, drawResult }) =>
        state === 'published' && drawResult?.kind === 'assigned' ? gameById(drawResult.gameId) : undefined,
      )
      .find(
        (assigned) =>
          assigned &&
          assigned.id !== game.id &&
          assigned.timeSlotIds.length > 1 &&
          assigned.timeSlotIds.some((id) => game.timeSlotIds.includes(id)),
      );
    if (held) return { kind: 'held', game: held, signedUp };
    const firstTimeSlotId = game.timeSlotIds[0]!;
    const rank = schedule.timeSlots.find(({ id }) => id === firstTimeSlotId)?.rank ?? 0;
    const slot = slotOf(firstTimeSlotId);
    if (slot?.state === 'drawing') return { kind: 'drawing', rank, signedUp };
    if (slot?.state === 'published') {
      const result = slot.drawResult;
      if (result?.kind === 'unassigned') return { kind: 'unassigned' };
      if (result?.kind === 'assigned' && result.gameId === game.id) return { kind: 'assigned-here' };
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

/** `time` (`HH:MM`), le jour `date` (`AAAA-MM-JJ`), est-il passé ? */
function isPast(date: string, time: string, now: Date): boolean {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  // L'heure locale du téléphone, qui est sur place, à l'heure de Paris.
  return now >= new Date(year, month - 1, day, hours, minutes);
}
