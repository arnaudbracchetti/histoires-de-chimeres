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

  /** Les heures d'un créneau qui porte une disponibilité ne se modifient plus (PR-11). */
  changeTimeSlotHours(id: string, start: TimeOfDay, end: TimeOfDay): void {
    const index = this.indexOf(id);
    const current = this.state.timeSlots[index]!;
    if (current.start.equals(start) && current.end.equals(end)) return;
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
    const games = this.state.games.filter((game) => game.isOn(id)).length;
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

  /** Retire la disponibilité du MJ sur un créneau existant. Retirer une absente ne change rien. */
  withdrawAvailability(gameMasterId: string, timeSlotId: string): void {
    const index = this.indexOfGameMaster(gameMasterId);
    this.verifyTimeSlotExists(timeSlotId);
    this.state.gameMasters[index] =
      this.state.gameMasters[index]!.withoutAvailabilityOn(timeSlotId);
  }

  /**
   * Fabrique le scénario d'un MJ existant, qui lui reste fixé (PR-16). La convention n'en garde
   * rien : le scénario est un agrégat à part (ADR 0005).
   */
  proposeScenario(id: string, gameMasterId: string, details: ScenarioDetails): Scenario {
    this.indexOfGameMaster(gameMasterId);
    return Scenario.propose(id, gameMasterId, details);
  }

  /** Le programme : les parties, dans l'ordre de leur programmation. */
  get games(): readonly Game[] {
    return [...this.state.games];
  }

  /**
   * Programme le scénario sur un créneau et une table (PR-3), dans le respect de PR-5. Seuls les
   * scénarios d'un créneau se programment ici ; les parties doubles viendront à part.
   */
  schedule(id: string, scenario: Scenario, timeSlotId: string, tableId: string): void {
    const refusal = this.schedulingRefusalOf(scenario, timeSlotId, tableId);
    if (refusal) throw refusal;
    this.state.games.push(new Game(id, scenario.id, scenario.gameMasterId, tableId, [timeSlotId]));
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
    this.state.games[index] = game.movedTo(
      tableId,
      this.consecutiveFrom(timeSlotId, game.timeSlotIds.length)!,
    );
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
   * Le verdict de chaque case créneaux × tables pour déplacer la partie : le refus que `moveGame()`
   * y lèverait, ou `null`. Sa propre case est permise. Dans l'ordre des créneaux, puis des tables.
   */
  movePlacementsOf(gameId: string): Placement[] {
    const game = this.state.games[this.indexOfGame(gameId)]!;
    return this.timeSlots.flatMap((slot) =>
      this.tables.map((table) => ({
        timeSlotId: slot.id,
        tableId: table.id,
        refusal: this.moveRefusalOf(game, slot.id, table.id),
      })),
    );
  }

  /**
   * La réserve (PR-6). Pour chaque scénario d'un seul créneau, et pour chaque créneau, dit :
   * - s'il est en réserve sur ce créneau : son MJ y est disponible et n'y mène pas déjà une partie.
   *   Peu importe qu'il soit déjà programmé sur un autre créneau, ou qu'une table soit libre ;
   * Un scénario ni en réserve ni programmé nulle part donne la raison dans `unschedulable`.
   * Un scénario en réserve sur aucun créneau donne la raison dans `unschedulable`.
   * Les scénarios suivent l'ordre du catalogue.
   */
  reserve(catalogue: ScenarioCatalogue): ReserveOfScenario[] {
    return catalogue
      .entries()
      .filter((entry) => entry.duration === 1)
      .map((entry) => {
        const gameMaster = this.gameMasterOf(entry.gameMasterId);
        const timeSlots = this.timeSlots.map((slot) => ({
          timeSlotId: slot.id,
          inReserve: gameMaster.isAvailableOn(slot.id) && !this.runsGameOn(gameMaster.id, slot.id),
          scheduled: this.isScheduledOn(entry.id, slot.id),
        }));
        return {
          scenarioId: entry.id,
          timeSlots,
          unschedulable: timeSlots.some(({ inReserve, scheduled }) => inReserve || scheduled)
            ? null
            : this.unschedulableRefusalOf(gameMaster),
        };
      });
  }

  /** La règle PR-5 d'une case pour programmer un scénario. */
  private schedulingRefusalOf(
    scenario: Scenario,
    timeSlotId: string,
    tableId: string,
  ): Refusal | null {
    // Les parties doubles viendront à part : ni verdict, ni écriture d'ici là.
    if (scenario.duration !== 1) {
      throw new RangeError(`Scénario de ${scenario.duration} créneaux : partie double à venir.`);
    }
    return this.placementRefusalOf(scenario.gameMasterId, 1, timeSlotId, tableId, null);
  }

  /** La règle PR-5 d'une case pour déplacer la partie, sans la compter elle-même. */
  private moveRefusalOf(game: Game, timeSlotId: string, tableId: string): Refusal | null {
    return this.placementRefusalOf(
      game.gameMasterId,
      game.timeSlotIds.length,
      timeSlotId,
      tableId,
      game,
    );
  }

  /**
   * La règle PR-5 d'une case, la même pour l'écriture et pour le verdict : une partie de `length`
   * créneaux du MJ, à partir de `timeSlotId`, sans compter `moving`, la partie qu'on déplace. Il
   * faut assez de créneaux consécutifs, puis, sur chacun, les motifs s'excluent dans cet ordre : MJ
   * indisponible, MJ déjà occupé, table prise.
   */
  private placementRefusalOf(
    gameMasterId: string,
    length: number,
    timeSlotId: string,
    tableId: string,
    moving: Game | null,
  ): Refusal | null {
    this.verifyTimeSlotExists(timeSlotId);
    const table = this.state.tables[this.indexOfTable(tableId)]!;
    const gameMaster = this.gameMasterOf(gameMasterId);
    const timeSlotIds = this.consecutiveFrom(timeSlotId, length);
    if (!timeSlotIds) return new Refusal('no-next-time-slot', { rank: this.rankOf(timeSlotId) });
    const others = this.state.games.filter((game) => game !== moving);
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

  /** Pourquoi un scénario du MJ n'est ni en réserve ni programmé nulle part. */
  private unschedulableRefusalOf(gameMaster: GameMaster): Refusal {
    const nickname = gameMaster.nickname.text;
    return this.timeSlots.some((slot) => gameMaster.isAvailableOn(slot.id))
      ? new Refusal('game-master-busy-everywhere', { nickname })
      : new Refusal('game-master-without-availability', { nickname });
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

  /** Vérifie qu'un créneau tient dans la journée (PR-8), et le renvoie. */
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
    return candidate;
  }
}

/** Le verdict d'une case créneau × table pour un scénario : le refus d'écriture, ou `null`. */
export type Placement = { timeSlotId: string; tableId: string; refusal: Refusal | null };

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
