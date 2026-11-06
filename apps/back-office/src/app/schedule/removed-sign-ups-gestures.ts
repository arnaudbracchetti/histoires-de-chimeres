import { inject, Injectable } from '@angular/core';
import { scheduleEndpoints, type GameDto, type ScheduleDto } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import type { Gesture } from '../gesture';
import { Confirmation } from '../ui/confirmation';
import type { GridTimeSlot } from './grid-time-slot';
import {
  buildUnscheduleConfirmation,
  type ConfirmationTexts,
  type CurrentSignUpFigures,
} from './removed-sign-ups-confirmations';

/**
 * La confirmation d'une déprogrammation, lue : ses textes, aucun sans inscrit ni tirage effacé ; ou
 * illisible.
 */
export type UnscheduleConfirmation =
  { status: 'read'; texts: ConfirmationTexts | undefined } | { status: 'unreadable' };

/**
 * Les gestes qui retirent des inscriptions, ou effacent un tirage provisoire (docs/design/patterns.md,
 * Actions destructrices),
 * confirmés d'abord s'ils en retirent, dans le Calendrier comme dans le pilotage. `onStale` : ce
 * que l'écran relit quand un refus le dit périmé.
 */
@Injectable({ providedIn: 'root' })
export class RemovedSignUpsGestures {
  private readonly confirmation = inject(Confirmation);
  private readonly apiCall = injectApiCall();

  /**
   * Déprogramme la partie : aussitôt sans inscrit ni tirage effacé, sinon après la confirmation, dont les chiffres
   * suivent `current` s'il est donné. Le geste retire les inscriptions présentes à l'écriture. Le
   * programme relu, ou `undefined` sans écriture.
   */
  async unschedule(
    game: GameDto,
    timeSlots: readonly GridTimeSlot[],
    gesture: Gesture,
    onStale: () => void,
    current?: CurrentSignUpFigures,
  ): Promise<ScheduleDto | undefined> {
    const confirmation = await this.readUnscheduleConfirmation(
      game,
      timeSlots,
      gesture,
      onStale,
      current,
    );
    if (confirmation.status === 'unreadable') return undefined;
    return this.writeConfirmingIfAny(
      () => this.apiCall(scheduleEndpoints.unschedule, { params: { gameId: game.id } }),
      confirmation.texts,
      gesture,
      onStale,
    );
  }

  /**
   * La confirmation de déprogrammer la partie, d'après les inscriptions que le geste retirerait et
   * le tirage provisoire qu'il effacerait, lus par `gesture`. `unreadable` si la lecture est refusée : le refus part en alerte, et s'il
   * dit l'écran périmé, `onStale`. Avec `current`, les chiffres du dialogue ouvert le suivent.
   */
  async readUnscheduleConfirmation(
    game: GameDto,
    timeSlots: readonly GridTimeSlot[],
    gesture: Gesture,
    onStale: () => void,
    current?: CurrentSignUpFigures,
  ): Promise<UnscheduleConfirmation> {
    const verdict = await gesture.run(() =>
      this.apiCall(scheduleEndpoints.unscheduleVerdict, { params: { gameId: game.id } }),
    );
    if (verdict.status === 'refused' && verdict.refusal.stale) onStale();
    if (verdict.status !== 'done') return { status: 'unreadable' };
    return {
      status: 'read',
      texts: buildUnscheduleConfirmation(game, verdict.value, timeSlots, current),
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
