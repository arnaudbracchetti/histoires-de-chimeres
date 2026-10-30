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
import { frontOfficeEndpoints, type FrontOfficeScheduleDto } from '@chimeres/contract';
import { formatDayAndMonth, formatTimeOfDay } from '@chimeres/design';
import { injectApiRead } from '../api-call';
import { LinkedPhone } from '../linked-phone';
import { readProblem } from '../problem';
import { PageVisibility } from './page-visibility';
import { PhoneClock } from './phone-clock';

/** Relecture tant que la page est visible (ADR 0011). */
const REREAD_EVERY_MS = 30_000;
/** Au-delà, la ligne d'âge dit de quand date la donnée (§6, Fraîcheur). */
const STALE_AFTER_MS = 2 * 60_000;

/**
 * Le seul module du front office qui lit et garde les données du participant (ADR 0011). Les écrans
 * lisent ses signaux, et n'appellent jamais l'API pour ces données. Il relit à l'ouverture, à chaque
 * écran, au retour au premier plan, et toutes les 30 s tant que la page est visible ; une lecture
 * qui échoue garde la dernière valeur. Fourni par la coquille : il part avec elle, et sa copie avec.
 */
@Injectable()
export class ParticipantData {
  private readonly apiRead = injectApiRead();
  private readonly clock = inject(PhoneClock);
  private readonly visibility = inject(PageVisibility);
  private readonly linkedPhone = inject(LinkedPhone);

  /** La dernière lecture réussie. */
  private readonly lastRead = signal<FrontOfficeScheduleDto | undefined>(undefined);
  /**
   * L'heure de cette lecture par le serveur : son en-tête `Date`, que le cache du service worker
   * garde. Une copie servie hors ligne garde donc son âge (ADR 0011).
   */
  private readonly readAt = signal<Date | undefined>(undefined);
  /** L'heure du téléphone, relevée à chaque relecture, réussie ou non. */
  private readonly now = signal(this.clock.now());
  /** Le serveur a refusé une lecture : la convention est terminée. */
  private readonly refusedAsEnded = signal(false);
  private reading = false;

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

  constructor() {
    void this.reread();
    this.rereadOnEachScreen();
    this.rereadInForeground();
  }

  /** Relit le programme. Une lecture déjà en cours suffit. */
  async reread(): Promise<void> {
    this.now.set(this.clock.now());
    if (this.reading) return;
    this.reading = true;
    try {
      const { body, servedAt } = await this.apiRead(frontOfficeEndpoints.readSchedule);
      this.lastRead.set(body);
      this.readAt.set(servedAt ?? this.clock.now());
    } catch (error) {
      // Sinon, la dernière valeur reste à l'écran (502 pendant un redéploiement, pas de réseau).
      const { code } = readProblem(error);
      if (code === 'convention-ended') this.refusedAsEnded.set(true);
      if (code === 'phone-not-linked') this.linkedPhone.unlinkedByServer();
    } finally {
      this.reading = false;
    }
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
