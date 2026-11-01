import { inject, Injectable } from '@angular/core';
import { scheduleEndpoints, type GameDto, type ScheduleDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import type { Gesture } from '../gesture';
import { Confirmation } from '../ui/confirmation';
import type { GridTimeSlot } from './grid-time-slot';
import {
  buildUnscheduleConfirmation,
  type ConfirmationTexts,
} from './removed-sign-ups-confirmations';

/** La confirmation d'une déprogrammation, lue : ses textes, aucun sans inscrit ; ou illisible. */
export type UnscheduleConfirmation =
  { status: 'read'; texts: ConfirmationTexts | undefined } | { status: 'unreadable' };

/**
 * Les gestes qui retirent des inscriptions (docs/design/patterns.md, Actions destructrices),
 * confirmés d'abord s'ils en retirent, dans le Calendrier comme dans le pilotage. `onStale` : ce
 * que l'écran relit quand un refus le dit périmé.
 */
@Injectable({ providedIn: 'root' })
export class RemovedSignUpsGestures {
  private readonly confirmation = inject(Confirmation);
  private readonly apiCall = injectApiCall();

  /**
   * Déprogramme la partie : aussitôt sans inscrit, sinon après la confirmation. Le programme relu,
   * ou `undefined` sans écriture.
   */
  async unschedule(
    game: GameDto,
    timeSlots: readonly GridTimeSlot[],
    gesture: Gesture,
    onStale: () => void,
  ): Promise<ScheduleDto | undefined> {
    const confirmation = await this.readUnscheduleConfirmation(game, timeSlots, gesture, onStale);
    if (confirmation.status === 'unreadable') return undefined;
    return this.writeConfirmingIfAny(
      () => this.apiCall(scheduleEndpoints.unschedule, { params: { gameId: game.id } }),
      confirmation.texts,
      gesture,
      onStale,
    );
  }

  /**
   * La confirmation de déprogrammer la partie, d'après les inscriptions que le geste retirerait,
   * lues par `gesture`. `unreadable` si la lecture est refusée : le refus part en alerte, et s'il
   * dit l'écran périmé, `onStale`.
   */
  async readUnscheduleConfirmation(
    game: GameDto,
    timeSlots: readonly GridTimeSlot[],
    gesture: Gesture,
    onStale: () => void,
  ): Promise<UnscheduleConfirmation> {
    const verdict = await gesture.run(() =>
      this.apiCall(scheduleEndpoints.unscheduleVerdict, { params: { gameId: game.id } }),
    );
    if (verdict.status === 'refused' && verdict.refusal.stale) onStale();
    if (verdict.status !== 'done') return { status: 'unreadable' };
    const [removed] = verdict.value.removedSignUps;
    return {
      status: 'read',
      texts: removed && buildUnscheduleConfirmation(game, removed, timeSlots),
    };
  }

  /**
   * Écrit le geste, confirmé d'abord s'il a des `texts` : sans eux, aussitôt par `gesture`, dont le
   * refus part en alerte ; avec eux, par le dialogue de confirmation, qui affiche son refus. Un refus
   * qui dit l'écran périmé appelle `onStale`. Le programme relu, ou `undefined` sans écriture.
   */
  async writeConfirmingIfAny(
    write: () => Promise<ScheduleDto>,
    texts: ConfirmationTexts | undefined,
    gesture: Gesture,
    onStale: () => void,
  ): Promise<ScheduleDto | undefined> {
    if (!texts) {
      const outcome = await gesture.run(write);
      if (outcome.status === 'refused' && outcome.refusal.stale) onStale();
      return outcome.status === 'done' ? outcome.value : undefined;
    }
    let written: ScheduleDto | undefined;
    const done = await this.confirmation.ask({
      ...texts,
      action: async () => (written = await write()),
      onStale,
    });
    return done ? written : undefined;
  }
}
