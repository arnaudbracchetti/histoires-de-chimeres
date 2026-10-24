import { ComparableName } from '../comparable-name.js';
import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type ScenarioDetails } from '../scenario/scenario.js';
import { Game } from './game.js';
import { GameMaster } from './game-master.js';
import { Table } from './table.js';
import type { TimeOfDay } from './time-of-day.js';
import { TimeSlot } from './time-slot.js';

export type ConventionState = {
  id: string;
  name: string;
  /** `AAAA-MM-JJ`, ou `null` tant qu'elle n'est pas fixée. */
  date: string | null;
  /** Dans n'importe quel ordre : `timeSlots` les rend dans l'ordre de la journée. */
  timeSlots: TimeSlot[];
  /** Dans n'importe quel ordre : `tables` les rend dans l'ordre naturel. */
  tables: Table[];
  /** Dans n'importe quel ordre : `gameMasters` les rend dans l'ordre naturel de leur pseudo. */
  gameMasters: GameMaster[];
  /** Les parties programmées, dans l'ordre de leur programmation. */
  games: Game[];
  /** Numéro de version, pour le verrou optimiste : seul le repository le fait avancer. */
  version: number;
};

/** La convention, racine de l'agrégat. Une base n'en a qu'une. */
export class Convention {
  /** Reprise par `contract` (`CONVENTION_NAME_MAX_LENGTH`) ; un test d'`application` vérifie qu'elles concordent. */
  static readonly NAME_MAX_LENGTH = 80;
  /** Reprise par `contract` (`TABLE_NAME_MAX_LENGTH`) ; le même test d'`application` le vérifie. */
  static readonly TABLE_NAME_MAX_LENGTH = 30;
  /** Reprise par `contract` (`NICKNAME_MAX_LENGTH`) ; le même test d'`application` le vérifie. */
  static readonly NICKNAME_MAX_LENGTH = 30;

  private constructor(private state: ConventionState) {}

  static restore(state: ConventionState): Convention {
    return new Convention({
      ...state,
      timeSlots: [...state.timeSlots],
      tables: [...state.tables],
      gameMasters: [...state.gameMasters],
      games: [...state.games],
    });
  }

  get id(): string {
    return this.state.id;
  }

  get name(): string {
    return this.state.name;
  }

  get date(): string | null {
    return this.state.date;
  }

  get version(): number {
    return this.state.version;
  }

  rename(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) throw new Refusal('convention-name-required', {});
    if (trimmed.length > Convention.NAME_MAX_LENGTH) {
      throw new Refusal('convention-name-too-long', { max: Convention.NAME_MAX_LENGTH });
    }
    this.state.name = trimmed;
  }

  /** Fixe la date (`AAAA-MM-JJ`), ou l'efface avec `null`. */
  setDate(date: string | null): void {
    this.state.date = date;
  }

  /** Les créneaux, dans l'ordre de la journée. */
  get timeSlots(): readonly TimeSlot[] {
    return [...this.state.timeSlots].sort((a, b) => a.start.minutes - b.start.minutes);
  }

  /** Rang du créneau dans la journée, à partir de 1 (PR-8). */
  rankOf(timeSlotId: string): number {
    return this.timeSlots.findIndex((slot) => slot.id === timeSlotId) + 1;
  }

  addTimeSlot(id: string, start: TimeOfDay, end: TimeOfDay): void {
    this.state.timeSlots.push(this.verifyFits(new TimeSlot(id, start, end)));
  }

  /** Les heures d'un créneau qui porte une partie ou une disponibilité ne se modifient plus (PR-11). */
  changeTimeSlotHours(id: string, start: TimeOfDay, end: TimeOfDay): void {
    const index = this.indexOf(id);
    const current = this.state.timeSlots[index]!;
    if (current.start.equals(start) && current.end.equals(end)) return;
    const games = this.gameCountOn(id);
    if (games > 0) {
      throw new Refusal('time-slot-hours-locked-by-games', { rank: this.rankOf(id), games });
    }
    const availabilities = this.availabilityCountOf(id);
    if (availabilities > 0) {
      throw new Refusal('time-slot-hours-locked', { rank: this.rankOf(id), availabilities });
    }
    this.state.timeSlots[index] = this.verifyFits(new TimeSlot(id, start, end));
  }

  /**
   * Supprime un créneau, et les disponibilités qui s'y rattachent. Un créneau qui porte des parties
   * reste (PR-10).
   */
  removeTimeSlot(id: string): void {
    const index = this.indexOf(id);
    const games = this.gameCountOn(id);
    if (games > 0) throw new Refusal('time-slot-has-games', { rank: this.rankOf(id), games });
    this.state.timeSlots.splice(index, 1);
    this.state.gameMasters = this.state.gameMasters.map((gameMaster) =>
      gameMaster.withoutAvailabilityOn(id),
    );
  }

  /** Nombre de MJ disponibles sur le créneau. */
  availabilityCountOf(timeSlotId: string): number {
    return this.state.gameMasters.filter((gameMaster) => gameMaster.isAvailableOn(timeSlotId))
      .length;
  }

  /** Les tables, dans l'ordre naturel : « Table 2 » avant « Table 10 ». */
  get tables(): readonly Table[] {
    return [...this.state.tables].sort((a, b) => a.name.compareTo(b.name));
  }

  addTable(id: string, name: string): void {
    this.state.tables.push(this.verifyTableName(new Table(id, ComparableName.of(name))));
  }

  /** Renomme une table, même si elle porte des parties. */
  renameTable(id: string, name: string): void {
    const index = this.indexOfTable(id);
    this.state.tables[index] = this.verifyTableName(new Table(id, ComparableName.of(name)));
  }

  /** Supprime une table. Une table qui porte des parties reste (PR-10). */
  removeTable(id: string): void {
    const index = this.indexOfTable(id);
    const games = this.state.games.filter((game) => game.tableId === id).length;
    if (games > 0) {
      throw new Refusal('table-has-games', { name: this.state.tables[index]!.name.text, games });
    }
    this.state.tables.splice(index, 1);
  }

  /** Les MJ, dans l'ordre naturel de leur pseudo. */
  get gameMasters(): readonly GameMaster[] {
    return [...this.state.gameMasters].sort((a, b) => a.nickname.compareTo(b.nickname));
  }

  addGameMaster(id: string, nickname: string): void {
    this.state.gameMasters.push(
      this.verifyNickname(new GameMaster(id, ComparableName.of(nickname))),
    );
  }

  /** Change le pseudo d'un MJ, à tout moment (PR-12). */
  renameGameMaster(id: string, nickname: string): void {
    const index = this.indexOfGameMaster(id);
    this.state.gameMasters[index] = this.verifyNickname(
      this.state.gameMasters[index]!.renamed(ComparableName.of(nickname)),
    );
  }

  /**
   * Supprime un MJ, et ses disponibilités avec lui. Un MJ qui a au moins un scénario reste (PR-12) :
   * le catalogue, entier, le dit.
   */
  removeGameMaster(id: string, catalogue: ScenarioCatalogue): void {
    const index = this.indexOfGameMaster(id);
    const scenarios = catalogue.countOf(id);
    if (scenarios > 0) throw new Refusal('game-master-has-scenarios', { scenarios });
    this.state.gameMasters.splice(index, 1);
  }

  /** Le MJ se déclare disponible sur un créneau existant (PR-2). Déclarer deux fois ne change rien. */
  declareAvailability(gameMasterId: string, timeSlotId: string): void {
    const index = this.indexOfGameMaster(gameMasterId);
    this.verifyTimeSlotExists(timeSlotId);
    this.state.gameMasters[index] = this.state.gameMasters[index]!.withAvailabilityOn(timeSlotId);
  }

  /**
   * Retire la disponibilité du MJ sur un créneau existant, sauf s'il y mène une partie (PR-15).
   * Retirer une absente ne change rien.
   */
  withdrawAvailability(gameMasterId: string, timeSlotId: string): void {
    const index = this.indexOfGameMaster(gameMasterId);
    this.verifyTimeSlotExists(timeSlotId);
    const refusal = this.withdrawalRefusalOf(gameMasterId, timeSlotId);
    if (refusal) throw refusal;
    this.state.gameMasters[index] =
      this.state.gameMasters[index]!.withoutAvailabilityOn(timeSlotId);
  }

  /**
   * Le verdict de retrait de chaque disponibilité du MJ, dans l'ordre de la journée : le refus que
   * `withdrawAvailability()` y lèverait, ou `null`.
   */
  withdrawalsOf(gameMasterId: string): Withdrawal[] {
    const gameMaster = this.gameMasterOf(gameMasterId);
    return this.timeSlots
      .filter((slot) => gameMaster.isAvailableOn(slot.id))
      .map((slot) => ({
        timeSlotId: slot.id,
        refusal: this.withdrawalRefusalOf(gameMasterId, slot.id),
      }));
  }

  /**
   * Fabrique le scénario d'un MJ existant, qui lui reste fixé (PR-16). La convention n'en garde
   * rien : le scénario est un agrégat à part (ADR 0005).
   */
  proposeScenario(id: string, gameMasterId: string, details: ScenarioDetails): Scenario {
    this.indexOfGameMaster(gameMasterId);
    return Scenario.propose(id, gameMasterId, details);
  }

  /** Le scénario a au moins une partie programmée (PR-14). */
  hasGamesOf(scenarioId: string): boolean {
    return this.state.games.some((game) => game.scenarioId === scenarioId);
  }

  /** Le programme : les parties, dans l'ordre de leur programmation. */
  get games(): readonly Game[] {
    return [...this.state.games];
  }

  /**
   * Programme le scénario sur un créneau et une table (PR-3), dans le respect de PR-5. Une partie
   * double se programme sur son premier créneau, et prend le suivant, à la même table.
   */
  schedule(id: string, scenario: Scenario, timeSlotId: string, tableId: string): void {
    const refusal = this.schedulingRefusalOf(scenario, timeSlotId, tableId);
    if (refusal) throw refusal;
    this.state.games.push(
      new Game(
        id,
        scenario.id,
        scenario.gameMasterId,
        tableId,
        this.consecutiveFrom(timeSlotId, scenario.duration)!,
      ),
    );
  }

  /**
   * Déplace la partie sur un créneau et une table (PR-17), dans le respect de PR-5, sans compter la
   * partie elle-même. Une partie double se déplace par son premier créneau, et prend le suivant.
   * Elle reste la même partie, avec ses places, à son rang dans le programme.
   */
  moveGame(gameId: string, timeSlotId: string, tableId: string): void {
    const index = this.indexOfGame(gameId);
    const game = this.state.games[index]!;
    const refusal = this.moveRefusalOf(game, timeSlotId, tableId);
    if (refusal) throw refusal;
    this.state.games[index] = this.placed(game, timeSlotId, tableId);
  }

  /**
   * Échange deux parties (PR-17) : chacune prend le premier créneau et la table de l'autre, en un
   * seul geste. Les deux places sont vérifiées ensemble contre PR-5, sans compter les deux parties à
   * leur ancienne place. Chacune reste la même partie, avec ses places, à son rang dans le programme.
   */
  swapGames(gameId: string, otherGameId: string): void {
    const index = this.indexOfGame(gameId);
    const otherIndex = this.indexOfGame(otherGameId);
    const game = this.state.games[index]!;
    const other = this.state.games[otherIndex]!;
    const refusal = this.swapRefusalOf(game, other);
    if (refusal) throw refusal;
    this.state.games[index] = this.placed(game, other.timeSlotIds[0]!, other.tableId);
    this.state.games[otherIndex] = this.placed(other, game.timeSlotIds[0]!, game.tableId);
  }

  /** Déprogramme la partie (PR-17) : son scénario reste proposé, et revient dans la réserve. */
  unschedule(gameId: string): void {
    this.state.games.splice(this.indexOfGame(gameId), 1);
  }

  /**
   * Le verdict de chaque case créneaux × tables pour le scénario : le refus que `schedule()` y
   * lèverait, ou `null`. Dans l'ordre des créneaux, puis des tables.
   */
  placementsOf(scenario: Scenario): Placement[] {
    return this.timeSlots.flatMap((slot) =>
      this.tables.map((table) => ({
        timeSlotId: slot.id,
        tableId: table.id,
        refusal: this.schedulingRefusalOf(scenario, slot.id, table.id),
      })),
    );
  }

  /**
   * Le verdict de chaque case créneaux × tables pour déplacer la partie, dans l'ordre des créneaux,
   * puis des tables. La première case d'une autre partie propose de l'échanger avec elle
   * (`swapWith`), avec le refus que `swapGames()` lèverait ; toute autre case, le refus que
   * `moveGame()` y lèverait. Sa propre case est permise.
   */
  movePlacementsOf(gameId: string): MovePlacement[] {
    const game = this.state.games[this.indexOfGame(gameId)]!;
    return this.timeSlots.flatMap((slot) =>
      this.tables.map((table) => {
        const other = this.state.games.find(
          (candidate) => candidate !== game && candidate.startsAt(slot.id, table.id),
        );
        return {
          timeSlotId: slot.id,
          tableId: table.id,
          swapWith: other?.id ?? null,
          refusal: other
            ? this.swapRefusalOf(game, other)
            : this.moveRefusalOf(game, slot.id, table.id),
        };
      }),
    );
  }

  /**
   * La réserve (PR-6). Pour chaque scénario, et pour chaque créneau, dit :
   * - s'il est en réserve sur ce créneau : son MJ y est disponible et n'y mène pas déjà une partie,
   *   sur ce créneau et le suivant pour un scénario double. Peu importe qu'il soit déjà programmé
   *   sur un autre créneau, ou qu'une table soit libre ;
   * - s'il y est programmé : une partie double l'est sur ses deux créneaux.
   * Un scénario ni en réserve ni programmé nulle part donne la raison dans `unschedulable`.
   * Les scénarios suivent l'ordre du catalogue.
   */
  reserve(catalogue: ScenarioCatalogue): ReserveOfScenario[] {
    return catalogue.entries().map((entry) => {
      const gameMaster = this.gameMasterOf(entry.gameMasterId);
      const timeSlots = this.timeSlots.map((slot) => ({
        timeSlotId: slot.id,
        inReserve: this.isFreeFrom(gameMaster, slot.id, entry.duration),
        scheduled: this.isScheduledOn(entry.id, slot.id),
      }));
      return {
        scenarioId: entry.id,
        timeSlots,
        unschedulable: timeSlots.some(({ inReserve, scheduled }) => inReserve || scheduled)
          ? null
          : this.unschedulableRefusalOf(gameMaster, entry.duration),
      };
    });
  }

  /** La règle PR-5 d'une case pour programmer un scénario. */
  private schedulingRefusalOf(
    scenario: Scenario,
    timeSlotId: string,
    tableId: string,
  ): Refusal | null {
    return this.placementRefusalOf(
      scenario.gameMasterId,
      scenario.duration,
      timeSlotId,
      tableId,
      this.state.games,
    );
  }

  /**
   * La règle PR-5 d'une case pour déplacer la partie parmi `others`, par défaut toutes les autres
   * parties.
   */
  private moveRefusalOf(
    game: Game,
    timeSlotId: string,
    tableId: string,
    others: readonly Game[] = this.state.games.filter((other) => other !== game),
  ): Refusal | null {
    return this.placementRefusalOf(
      game.gameMasterId,
      game.timeSlotIds.length,
      timeSlotId,
      tableId,
      others,
    );
  }

  /**
   * La règle PR-5 de l'échange de deux parties : chacune à la place de l'autre, sans compter les deux
   * à leur ancienne place. La seconde se vérifie avec la première déjà à sa nouvelle place.
   */
  private swapRefusalOf(game: Game, other: Game): Refusal | null {
    if (game === other) return new Refusal('game-swapped-with-itself', {});
    const rest = this.state.games.filter((candidate) => candidate !== game && candidate !== other);
    const moved = this.placed(game, other.timeSlotIds[0]!, other.tableId);
    return (
      this.moveRefusalOf(game, other.timeSlotIds[0]!, other.tableId, rest) ??
      this.moveRefusalOf(other, game.timeSlotIds[0]!, game.tableId, [...rest, moved])
    );
  }

  /** La même partie, sur la table et à partir du créneau donnés, qui permettent sa durée. */
  private placed(game: Game, timeSlotId: string, tableId: string): Game {
    return game.movedTo(tableId, this.consecutiveFrom(timeSlotId, game.timeSlotIds.length)!);
  }

  /**
   * La règle PR-5 d'une case, la même pour l'écriture et pour le verdict : une partie de `length`
   * créneaux du MJ, à partir de `timeSlotId`, parmi `others`, les parties déjà placées. Il faut
   * assez de créneaux consécutifs, puis, sur chacun, les motifs s'excluent dans cet ordre : MJ
   * indisponible, MJ déjà occupé, table prise.
   */
  private placementRefusalOf(
    gameMasterId: string,
    length: number,
    timeSlotId: string,
    tableId: string,
    others: readonly Game[],
  ): Refusal | null {
    this.verifyTimeSlotExists(timeSlotId);
    const table = this.state.tables[this.indexOfTable(tableId)]!;
    const gameMaster = this.gameMasterOf(gameMasterId);
    const timeSlotIds = this.consecutiveFrom(timeSlotId, length);
    if (!timeSlotIds) return new Refusal('no-next-time-slot', { rank: this.rankOf(timeSlotId) });
    const nickname = gameMaster.nickname.text;
    for (const slotId of timeSlotIds) {
      const rank = this.rankOf(slotId);
      if (!gameMaster.isAvailableOn(slotId)) {
        return new Refusal('game-master-unavailable', { nickname, rank });
      }
      if (others.some((game) => game.gameMasterId === gameMasterId && game.isOn(slotId))) {
        return new Refusal('game-master-busy', { nickname, rank });
      }
      if (others.some((game) => game.tableId === tableId && game.isOn(slotId))) {
        return new Refusal('table-taken', { table: table.name.text, rank });
      }
    }
    return null;
  }

  /** Les `length` créneaux consécutifs à partir de `timeSlotId` (PR-8), ou `null` s'ils manquent. */
  private consecutiveFrom(timeSlotId: string, length: number): string[] | null {
    const slots = this.timeSlots;
    const start = slots.findIndex((slot) => slot.id === timeSlotId);
    const following = slots.slice(start, start + length);
    return following.length === length ? following.map(({ id }) => id) : null;
  }

  /**
   * Le MJ est disponible et ne mène aucune partie sur les `length` créneaux consécutifs à partir de
   * `timeSlotId`, qui existent.
   */
  private isFreeFrom(gameMaster: GameMaster, timeSlotId: string, length: number): boolean {
    const timeSlotIds = this.consecutiveFrom(timeSlotId, length);
    return (
      timeSlotIds !== null &&
      timeSlotIds.every(
        (slotId) => gameMaster.isAvailableOn(slotId) && !this.runsGameOn(gameMaster.id, slotId),
      )
    );
  }

  /** Pourquoi un scénario de `length` créneaux du MJ n'est ni en réserve ni programmé nulle part. */
  private unschedulableRefusalOf(gameMaster: GameMaster, length: number): Refusal {
    const nickname = gameMaster.nickname.text;
    if (!this.timeSlots.some((slot) => gameMaster.isAvailableOn(slot.id))) {
      return new Refusal('game-master-without-availability', { nickname });
    }
    const available = this.timeSlots.some((slot) =>
      this.consecutiveFrom(slot.id, length)?.every((slotId) => gameMaster.isAvailableOn(slotId)),
    );
    return available
      ? new Refusal('game-master-busy-everywhere', { nickname })
      : new Refusal('game-master-without-consecutive-availabilities', { nickname });
  }

  /** La règle PR-15 du retrait d'une disponibilité, la même pour l'écriture et pour le verdict. */
  private withdrawalRefusalOf(gameMasterId: string, timeSlotId: string): Refusal | null {
    if (!this.runsGameOn(gameMasterId, timeSlotId)) return null;
    return new Refusal('availability-has-game', {
      nickname: this.gameMasterOf(gameMasterId).nickname.text,
      rank: this.rankOf(timeSlotId),
    });
  }

  private gameCountOn(timeSlotId: string): number {
    return this.state.games.filter((game) => game.isOn(timeSlotId)).length;
  }

  private isScheduledOn(scenarioId: string, timeSlotId: string): boolean {
    return this.state.games.some((game) => game.scenarioId === scenarioId && game.isOn(timeSlotId));
  }

  private runsGameOn(gameMasterId: string, timeSlotId: string): boolean {
    return this.state.games.some(
      (game) => game.gameMasterId === gameMasterId && game.isOn(timeSlotId),
    );
  }

  private indexOfGame(gameId: string): number {
    const index = this.state.games.findIndex((game) => game.id === gameId);
    if (index < 0) throw new Refusal('game-not-found', {});
    return index;
  }

  private gameMasterOf(gameMasterId: string): GameMaster {
    return this.state.gameMasters[this.indexOfGameMaster(gameMasterId)]!;
  }

  private indexOfGameMaster(gameMasterId: string): number {
    const index = this.state.gameMasters.findIndex((gameMaster) => gameMaster.id === gameMasterId);
    if (index < 0) throw new Refusal('game-master-not-found', {});
    return index;
  }

  /** Vérifie le pseudo d'un MJ : obligatoire, borné, unique parmi les MJ (PR-12, ID-7). */
  private verifyNickname(candidate: GameMaster): GameMaster {
    const { text } = candidate.nickname;
    if (!text) throw new Refusal('nickname-required', {});
    if (text.length > Convention.NICKNAME_MAX_LENGTH) {
      throw new Refusal('nickname-too-long', { max: Convention.NICKNAME_MAX_LENGTH });
    }
    const namesake = this.state.gameMasters.find(
      (gameMaster) =>
        gameMaster.id !== candidate.id && gameMaster.nickname.equals(candidate.nickname),
    );
    if (namesake) throw new Refusal('nickname-taken', { nickname: namesake.nickname.text });
    return candidate;
  }

  private indexOfTable(tableId: string): number {
    const index = this.state.tables.findIndex((table) => table.id === tableId);
    if (index < 0) throw new Refusal('table-not-found', {});
    return index;
  }

  /** Vérifie le nom d'une table : obligatoire, borné, unique dans la convention (PR-9). */
  private verifyTableName(candidate: Table): Table {
    const { text } = candidate.name;
    if (!text) throw new Refusal('table-name-required', {});
    if (text.length > Convention.TABLE_NAME_MAX_LENGTH) {
      throw new Refusal('table-name-too-long', { max: Convention.TABLE_NAME_MAX_LENGTH });
    }
    const namesake = this.state.tables.find(
      (table) => table.id !== candidate.id && table.name.equals(candidate.name),
    );
    if (namesake) throw new Refusal('table-name-taken', { name: namesake.name.text });
    return candidate;
  }

  /** Une disponibilité ou une partie porte sur un créneau existant. */
  private verifyTimeSlotExists(timeSlotId: string): void {
    this.indexOf(timeSlotId);
  }

  private indexOf(timeSlotId: string): number {
    const index = this.state.timeSlots.findIndex((slot) => slot.id === timeSlotId);
    if (index < 0) throw new Refusal('time-slot-not-found', {});
    return index;
  }

  /**
   * Vérifie qu'un créneau tient dans la journée (PR-8), sans se placer entre les deux créneaux d'une
   * partie double (PR-11), et le renvoie.
   */
  private verifyFits(candidate: TimeSlot): TimeSlot {
    if (!candidate.start.isBefore(candidate.end)) {
      throw new Refusal('time-slot-end-not-after-start', {});
    }
    const overlapped = this.timeSlots.find(
      (slot) => slot.id !== candidate.id && slot.overlaps(candidate),
    );
    if (overlapped) {
      const rank = this.rankOf(overlapped.id);
      throw overlapped.includes(candidate.start)
        ? new Refusal('time-slot-start-overlaps', { rank })
        : new Refusal('time-slot-end-overlaps', { rank });
    }
    const dayTimeSlotIds = [
      ...this.state.timeSlots.filter((slot) => slot.id !== candidate.id),
      candidate,
    ]
      .sort((a, b) => a.start.minutes - b.start.minutes)
      .map(({ id }) => id);
    const split = this.state.games.find((game) => !game.isConsecutiveIn(dayTimeSlotIds));
    if (split) {
      throw new Refusal('time-slot-splits-two-slot-game', {
        rank: this.rankOf(split.timeSlotIds[0]!),
      });
    }
    return candidate;
  }
}

/** Le verdict d'une case créneau × table pour un scénario : le refus d'écriture, ou `null`. */
export type Placement = { timeSlotId: string; tableId: string; refusal: Refusal | null };

/**
 * Le verdict d'une case créneau × table pour déplacer une partie : `swapWith`, l'id de la partie
 * avec laquelle l'échanger, ou `null` pour un déplacement ; le refus d'écriture, ou `null`.
 */
export type MovePlacement = Placement & { swapWith: string | null };

/** Le verdict de retrait d'une disponibilité : le refus d'écriture, ou `null`. */
export type Withdrawal = { timeSlotId: string; refusal: Refusal | null };

/**
 * La place d'un scénario dans la réserve : sur chaque créneau, dans l'ordre de la journée, s'il y
 * est en réserve et s'il y est programmé. Les deux s'excluent : son MJ y mènerait déjà une partie.
 * `unschedulable` : le refus qui explique pourquoi il n'est ni en réserve ni programmé nulle part,
 * ou `null`.
 */
export type ReserveOfScenario = {
  scenarioId: string;
  timeSlots: { timeSlotId: string; inReserve: boolean; scheduled: boolean }[];
  unschedulable: Refusal | null;
};
