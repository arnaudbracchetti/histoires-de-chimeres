import type { Seats } from '../scenario/seats.js';

/**
 * Partie : un scénario programmé sur un créneau, à une table. Entité de l'agrégat Convention, qui en
 * garde les règles (PR-5). Elle retient de son scénario ce que ces règles en lisent : son MJ.
 */
export class Game {
  /**
   * `timeSlotIds` : ses créneaux, dans l'ordre de la journée ; `seats` : ses propres places, ou
   * `null` pour celles de son scénario (PR-4).
   */
  constructor(
    readonly id: string,
    readonly scenarioId: string,
    readonly gameMasterId: string,
    readonly tableId: string,
    readonly timeSlotIds: readonly string[],
    readonly seats: Seats | null = null,
  ) {}

  isOn(timeSlotId: string): boolean {
    return this.timeSlotIds.includes(timeSlotId);
  }
}
