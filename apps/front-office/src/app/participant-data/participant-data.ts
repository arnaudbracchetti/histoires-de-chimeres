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
  type FrontOfficeScheduleDto,
  type FrontOfficeTimeSlotDto,
} from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { PageVisibility } from './page-visibility';
import { PhoneClock } from './phone-clock';

/** Relecture tant que la page est visible (ADR 0011). */
const REREAD_EVERY_MS = 30_000;

/**
 * Le seul module du front office qui lit et garde les données du participant (ADR 0011). Les écrans
 * lisent ses signaux, et n'appellent jamais l'API pour ces données. Il relit à l'ouverture, à chaque
 * écran, au retour au premier plan, et toutes les 30 s tant que la page est visible ; une lecture
 * qui échoue garde la dernière valeur. Fourni par la coquille : il part avec elle, et sa copie avec.
 */
@Injectable()
export class ParticipantData {
  private readonly apiCall = injectApiCall();
  private readonly clock = inject(PhoneClock);
  private readonly visibility = inject(PageVisibility);

  /** La dernière lecture réussie. */
  private readonly lastRead = signal<FrontOfficeScheduleDto | undefined>(undefined);
  /** L'heure du téléphone, relevée à chaque relecture, réussie ou non. */
  private readonly now = signal(this.clock.now());
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
    const timeSlots = schedule.timeSlots.filter((slot) => !hasEnded(schedule.date, slot, now));
    const remaining = new Set(timeSlots.map(({ id }) => id));
    return {
      ...schedule,
      timeSlots,
      games: schedule.games.filter((game) => remaining.has(game.timeSlotIds[0]!)),
    };
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
      this.lastRead.set(await this.apiCall(frontOfficeEndpoints.readSchedule));
    } catch {
      // La dernière valeur reste à l'écran (502 pendant un redéploiement, pas de réseau).
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

/** Un créneau est terminé à sa fin, le jour de la convention. Sans date, aucun ne se termine. */
function hasEnded(date: string | null, slot: FrontOfficeTimeSlotDto, now: Date): boolean {
  if (date === null) return false;
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hours, minutes] = slot.end.split(':').map(Number) as [number, number];
  // L'heure locale du téléphone, qui est sur place, à l'heure de Paris.
  return now >= new Date(year, month - 1, day, hours, minutes);
}
