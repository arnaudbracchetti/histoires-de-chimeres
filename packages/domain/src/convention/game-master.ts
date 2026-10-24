import type { ComparableName } from '../comparable-name.js';

/** MJ : la personne qui mène des parties. Entité de l'agrégat Convention, qui en garde les règles. */
export class GameMaster {
  readonly availabilities: ReadonlySet<string>;

  /** `availabilities` : les identifiants des créneaux où le MJ est disponible (PR-2). */
  constructor(
    readonly id: string,
    readonly nickname: ComparableName,
    availabilities: Iterable<string> = [],
  ) {
    this.availabilities = new Set(availabilities);
  }

  isAvailableOnTimeSlot(timeSlotId: string): boolean {
    return this.availabilities.has(timeSlotId);
  }

  afterRenaming(nickname: ComparableName): GameMaster {
    return new GameMaster(this.id, nickname, this.availabilities);
  }

  afterDeclaringAvailability(timeSlotId: string): GameMaster {
    return new GameMaster(this.id, this.nickname, [...this.availabilities, timeSlotId]);
  }

  afterWithdrawingAvailability(timeSlotId: string): GameMaster {
    return new GameMaster(
      this.id,
      this.nickname,
      [...this.availabilities].filter((id) => id !== timeSlotId),
    );
  }
}
