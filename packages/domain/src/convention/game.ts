import type { Day } from './day.js';

/**
 * Partie : un scénario programmé sur un créneau, à une table. Entité de l'agrégat Convention, qui en
 * garde les règles (PR-5). Elle retient de son scénario ce que ces règles en lisent : son MJ.
 */
export class Game {
  /**
   * `timeSlotIds` : ses créneaux, dans l'ordre de la journée. Ses places sont celles de son
   * scénario (PR-4).
   */
  constructor(
    readonly id: string,
    readonly scenarioId: string,
    readonly gameMasterId: string,
    readonly tableId: string,
    readonly timeSlotIds: readonly string[],
  ) {}

  isOnTimeSlot(timeSlotId: string): boolean {
    return this.timeSlotIds.includes(timeSlotId);
  }

  /** Elle commence sur ce créneau, à cette table : c'est sa première case. */
  startsAtTimeSlotAndTable(timeSlotId: string, tableId: string): boolean {
    return this.timeSlotIds[0] === timeSlotId && this.tableId === tableId;
  }

  /** Ses créneaux se suivent dans la journée : aucun autre ne s'est glissé entre eux (PR-11). */
  isConsecutiveIn(day: Day): boolean {
    const following = day.consecutiveTimeSlotIdsFrom(this.timeSlotIds[0]!, this.timeSlotIds.length);
    return (
      following !== null && following.every((slotId, offset) => this.timeSlotIds[offset] === slotId)
    );
  }

  /** La même partie, sur une autre table et d'autres créneaux (PR-17). */
  afterMovingTo(tableId: string, timeSlotIds: readonly string[]): Game {
    return new Game(this.id, this.scenarioId, this.gameMasterId, tableId, timeSlotIds);
  }
}
