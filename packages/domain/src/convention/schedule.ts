import { Refusal } from '../refusal.js';
import type { Scenario } from '../scenario/scenario.js';
import type { Day } from './day.js';
import { Game } from './game.js';
import type { GameMaster } from './game-master.js';
import type { Table } from './table.js';

/**
 * Ce que la règle PR-5 lit hors du Programme pour placer une partie : le MJ qui la mène, et la table
 * où elle va. La convention les trouve, et refuse ceux qui n'existent pas.
 */
export type PlacementCollaborators = { gameMaster: GameMaster; table: Table };

/**
 * Programme : les parties programmées, dans l'ordre de leur programmation. Il garde la règle PR-5,
 * la même pour l'écriture et pour le verdict : chaque geste rend le Programme d'après, ou le refus
 * qui l'empêche. Immuable. La journée lui est passée à chaque geste : c'est la convention qui la
 * détient.
 */
export class Schedule {
  private constructor(readonly games: readonly Game[]) {}

  /** `games`, dans l'ordre de leur programmation. */
  static createFromGames(games: Iterable<Game>): Schedule {
    return new Schedule([...games]);
  }

  /** La partie, qui doit exister. */
  findExistingGameById(gameId: string): Game {
    const game = this.games.find((candidate) => candidate.id === gameId);
    if (!game) throw new Refusal('game-not-found', {});
    return game;
  }

  /** La partie y est encore, sur les mêmes créneaux : ses inscriptions restent (IN-6). */
  hasGameOnSameTimeSlots(game: Game): boolean {
    return this.games.some(
      (candidate) => candidate.id === game.id && candidate.isOnSameTimeSlotsAs(game),
    );
  }

  countGamesOnTimeSlot(timeSlotId: string): number {
    return this.games.filter((game) => game.isOnTimeSlot(timeSlotId)).length;
  }

  countGamesAtTable(tableId: string): number {
    return this.games.filter((game) => game.tableId === tableId).length;
  }

  /** Le scénario a au moins une partie programmée (PR-14). */
  isScenarioScheduled(scenarioId: string): boolean {
    return this.games.some((game) => game.scenarioId === scenarioId);
  }

  isScenarioScheduledOnTimeSlot(scenarioId: string, timeSlotId: string): boolean {
    return this.games.some(
      (game) => game.scenarioId === scenarioId && game.isOnTimeSlot(timeSlotId),
    );
  }

  isGameMasterLeadingOnTimeSlot(gameMasterId: string, timeSlotId: string): boolean {
    return this.findGameLedByGameMasterOnTimeSlot(gameMasterId, timeSlotId) !== undefined;
  }

  /** La partie que le MJ mène sur ce créneau, ou `undefined`. */
  findGameLedByGameMasterOnTimeSlot(gameMasterId: string, timeSlotId: string): Game | undefined {
    return this.games.find(
      (game) => game.gameMasterId === gameMasterId && game.isOnTimeSlot(timeSlotId),
    );
  }

  /** Les créneaux où le MJ mène une partie. */
  listTimeSlotIdsLedByGameMaster(gameMasterId: string): string[] {
    return this.games
      .filter((game) => game.gameMasterId === gameMasterId)
      .flatMap((game) => game.timeSlotIds);
  }

  /** La partie, autre que `game`, dont c'est la première case, ou `undefined`. */
  findOtherGameStartingAt(
    game: Game,
    timeSlotId: string,
    tableId: string,
  ): Game | undefined {
    return this.games.find(
      (candidate) =>
        candidate.id !== game.id && candidate.isStartingAt(timeSlotId, tableId),
    );
  }

  /**
   * Le Programme après la programmation du scénario à partir de ce créneau (PR-3), ou le refus de
   * PR-5. Une partie double prend aussi le créneau suivant, à la même table.
   */
  getScheduleAfterSchedulingScenario(
    id: string,
    scenario: Scenario,
    timeSlotId: string,
    collaborators: PlacementCollaborators,
    day: Day,
  ): Schedule | Refusal {
    const timeSlotIds = day.findConsecutiveTimeSlotIds(timeSlotId, scenario.duration);
    if (!timeSlotIds)
      return new Refusal('no-next-time-slot', { rank: day.getTimeSlotRank(timeSlotId) });
    const game = new Game(
      id,
      scenario.id,
      scenario.gameMasterId,
      collaborators.table.id,
      timeSlotIds,
    );
    const next = new Schedule([...this.games, game]);
    return next.findPlacementRefusal(game, collaborators, day) ?? next;
  }

  /**
   * Le Programme après le déplacement de la partie à partir de ce créneau (PR-17), ou le refus de
   * PR-5. Elle reste la même partie, avec ses places, à son rang dans le programme.
   */
  getScheduleAfterMovingGame(
    game: Game,
    timeSlotId: string,
    collaborators: PlacementCollaborators,
    day: Day,
  ): Schedule | Refusal {
    const moved = this.getGameAfterMoving(game, timeSlotId, collaborators.table.id, day);
    if (moved instanceof Refusal) return moved;
    const next = this.getScheduleAfterReplacingGames([moved]);
    return next.findPlacementRefusal(moved, collaborators, day) ?? next;
  }

  /**
   * Le Programme après l'échange des deux parties (PR-17) : chacune prend le premier créneau et la
   * table de l'autre. Ou le refus de PR-5, vérifié pour la première, puis pour la seconde, toutes
   * deux à leur nouvelle place. `otherCollaborators` : le MJ de l'autre partie, et la table de la
   * première.
   */
  getScheduleAfterSwappingGames(
    game: Game,
    collaborators: PlacementCollaborators,
    other: Game,
    otherCollaborators: PlacementCollaborators,
    day: Day,
  ): Schedule | Refusal {
    if (game.id === other.id) return new Refusal('game-swapped-with-itself', {});
    const moved = this.getGameAfterMoving(game, other.timeSlotIds[0]!, other.tableId, day);
    if (moved instanceof Refusal) return moved;
    const otherMoved = this.getGameAfterMoving(other, game.timeSlotIds[0]!, game.tableId, day);
    if (otherMoved instanceof Refusal) return otherMoved;
    const next = this.getScheduleAfterReplacingGames([moved, otherMoved]);
    return (
      next.findPlacementRefusal(moved, collaborators, day) ??
      next.findPlacementRefusal(otherMoved, otherCollaborators, day) ??
      next
    );
  }

  /** Le Programme après le retrait de la partie (PR-17). */
  getScheduleAfterUnschedulingGame(gameId: string): Schedule {
    const game = this.findExistingGameById(gameId);
    return new Schedule(this.games.filter((candidate) => candidate !== game));
  }

  /**
   * Refuse une journée qui ne garderait pas chaque partie double sur deux créneaux consécutifs
   * (PR-11). Le refus donne le rang de la partie dans la journée actuelle.
   */
  verifyTwoSlotGamesStayConsecutive(currentDay: Day, nextDay: Day): void {
    const split = this.games.find((game) => !game.hasConsecutiveTimeSlotsIn(nextDay));
    if (split) {
      throw new Refusal('time-slot-splits-two-slot-game', {
        rank: currentDay.getTimeSlotRank(split.timeSlotIds[0]!),
      });
    }
  }

  /**
   * La règle PR-5 pour une partie déjà à sa place dans ce Programme, parmi les autres parties. Sur
   * chacun de ses créneaux, les motifs s'excluent dans cet ordre : MJ indisponible, MJ déjà occupé,
   * table prise.
   */
  private findPlacementRefusal(
    game: Game,
    { gameMaster, table }: PlacementCollaborators,
    day: Day,
  ): Refusal | null {
    const others = this.games.filter((candidate) => candidate.id !== game.id);
    const nickname = gameMaster.nickname.text;
    for (const slotId of game.timeSlotIds) {
      const rank = day.getTimeSlotRank(slotId);
      if (!gameMaster.isAvailableOnTimeSlot(slotId)) {
        return new Refusal('game-master-unavailable', { nickname, rank });
      }
      if (
        others.some((other) => other.gameMasterId === gameMaster.id && other.isOnTimeSlot(slotId))
      ) {
        return new Refusal('game-master-busy', { nickname, rank });
      }
      if (others.some((other) => other.tableId === table.id && other.isOnTimeSlot(slotId))) {
        return new Refusal('table-taken', { table: table.name.text, rank });
      }
    }
    return null;
  }

  /** La même partie, sur la table et à partir du créneau donnés, ou le refus s'ils ne permettent pas sa durée. */
  private getGameAfterMoving(
    game: Game,
    timeSlotId: string,
    tableId: string,
    day: Day,
  ): Game | Refusal {
    const timeSlotIds = day.findConsecutiveTimeSlotIds(timeSlotId, game.timeSlotIds.length);
    if (!timeSlotIds)
      return new Refusal('no-next-time-slot', { rank: day.getTimeSlotRank(timeSlotId) });
    return game.getGameAfterMovingTo(tableId, timeSlotIds);
  }

  /** Ce Programme, où chaque partie de `moved` remplace celle de même id, à son rang. */
  private getScheduleAfterReplacingGames(moved: readonly Game[]): Schedule {
    return new Schedule(
      this.games.map((game) => moved.find((candidate) => candidate.id === game.id) ?? game),
    );
  }
}
