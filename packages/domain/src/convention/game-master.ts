import type { ComparableName } from '../comparable-name.js';
import { Participant } from './participant.js';

/**
 * MJ : la personne qui mène des parties. Entité de l'agrégat Convention, qui en garde les règles.
 * Un MJ est un participant, qui a en plus ce rôle : son pseudo est celui de son participant
 * (ADR 0012).
 */
export class GameMaster {
  readonly availabilities: ReadonlySet<string>;

  /** `availabilities` : les identifiants des créneaux où le MJ est disponible (PR-2). */
  constructor(
    readonly id: string,
    readonly participant: Participant,
    availabilities: Iterable<string> = [],
  ) {
    this.availabilities = new Set(availabilities);
  }

  get nickname(): ComparableName {
    return this.participant.nickname;
  }

  isAvailableOnTimeSlot(timeSlotId: string): boolean {
    return this.availabilities.has(timeSlotId);
  }

  /** Le MJ après le renommage de son participant, qui garde son identifiant. */
  afterRenaming(nickname: ComparableName): GameMaster {
    return new GameMaster(
      this.id,
      new Participant(this.participant.id, nickname),
      this.availabilities,
    );
  }

  afterDeclaringAvailability(timeSlotId: string): GameMaster {
    return new GameMaster(this.id, this.participant, [...this.availabilities, timeSlotId]);
  }

  afterWithdrawingAvailability(timeSlotId: string): GameMaster {
    return new GameMaster(
      this.id,
      this.participant,
      [...this.availabilities].filter((id) => id !== timeSlotId),
    );
  }
}
