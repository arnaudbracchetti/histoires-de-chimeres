import { ComparableName } from '../comparable-name.js';
import type { Notification } from '../notification.js';
import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type ScenarioDetails } from '../scenario/scenario.js';
import type { Seats } from '../scenario/seats.js';
import { Day } from './day.js';
import type { Game } from './game.js';
import { GameMaster } from './game-master.js';
import type { LocalMoment } from './local-moment.js';
import { Participant } from './participant.js';
import type { PresenceCode } from './presence-code.js';
import { Table } from './table.js';
import { computeReserve, type ReserveOfScenario } from './reserve.js';
import { Schedule, type PlacementCollaborators } from './schedule.js';
import { SignUp } from './sign-up.js';
import type { TimeOfDay } from './time-of-day.js';
import type { TimeSlot } from './time-slot.js';
import { UniquelyNamedCollection, type NamingRules } from './uniquely-named-collection.js';

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
  /** Dans n'importe quel ordre. Ceux des MJ peuvent y manquer : chaque MJ apporte le sien. */
  participants: Participant[];
  /** Dans l'ordre où elles ont été prises. */
  signUps: SignUp[];
  /** Les parties programmées, dans l'ordre de leur programmation. */
  games: Game[];
  /** Numéro de version, pour le verrou optimiste : seul le repository le fait avancer. */
  version: number;
  /** Fixé à la création de la convention, il ne change plus (ID-2). */
  presenceCode: PresenceCode;
};

/** La convention, racine de l'agrégat. Une base n'en a qu'une. */
export class Convention {
  /** Reprise par `contract` (`CONVENTION_NAME_MAX_LENGTH`) ; un test d'`application` vérifie qu'elles concordent. */
  static readonly NAME_MAX_LENGTH = 80;
  /** Reprise par `contract` (`TABLE_NAME_MAX_LENGTH`) ; le même test d'`application` le vérifie. */
  static readonly TABLE_NAME_MAX_LENGTH = 30;
  /** Reprise par `contract` (`NICKNAME_MAX_LENGTH`) ; le même test d'`application` le vérifie. */
  static readonly NICKNAME_MAX_LENGTH = 30;

  /**
   * La fin de la convention : la fin de son dernier créneau, le jour de sa date. Sans date ou sans
   * créneau, elle n'en a pas : les Organisateurs testent le front office avant le jour J. Les créneaux
   * ne se chevauchent pas, donc le dernier est celui qui finit le plus tard. Statique pour que la
   * lecture la calcule sans charger l'agrégat.
   */
  static computeEnd(date: string | null, timeSlotEnds: readonly TimeOfDay[]): LocalMoment | null {
    const [first, ...others] = timeSlotEnds;
    if (date === null || !first) return null;
    return { date, time: others.reduce((last, end) => (last.isBefore(end) ? end : last), first) };
  }

  /**
   * Une inscription ne compte pas tant que son participant mène une partie sur l'un des créneaux de
   * la partie (IN-4) : ni dans le nombre d'inscrits, ni dans « très demandée », ni dans le tirage.
   * Elle reste en place, et reprend effet quand il n'y mène plus. Statique pour que la lecture
   * compte les inscrits sans charger l'agrégat.
   */
  static isSignUpSuspendedByLedTimeSlots(
    gameTimeSlotIds: readonly string[],
    timeSlotIdsLedByParticipant: readonly string[],
  ): boolean {
    return gameTimeSlotIds.some((slotId) => timeSlotIdsLedByParticipant.includes(slotId));
  }

  private constructor(
    private state: Pick<ConventionState, 'id' | 'name' | 'date' | 'version' | 'presenceCode'>,
    private day: Day,
    private allTables: UniquelyNamedCollection<Table>,
    private allGameMasters: UniquelyNamedCollection<GameMaster>,
    private allParticipants: UniquelyNamedCollection<Participant>,
    private gameSchedule: Schedule,
    private allSignUps: readonly SignUp[],
  ) {}

  static restore({
    timeSlots,
    tables,
    gameMasters,
    participants,
    signUps,
    games,
    ...state
  }: ConventionState): Convention {
    return new Convention(
      state,
      Day.createFromTimeSlots(timeSlots),
      UniquelyNamedCollection.createFromItems(tables, TABLE_NAMING_RULES),
      UniquelyNamedCollection.createFromItems(gameMasters, NICKNAME_RULES),
      UniquelyNamedCollection.createFromItems(
        new Map(
          [...participants, ...gameMasters.map((gameMaster) => gameMaster.participant)].map(
            (participant) => [participant.id, participant],
          ),
        ).values(),
        PARTICIPANT_NICKNAME_RULES,
      ),
      Schedule.createFromGames(games),
      signUps,
    );
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

  get presenceCode(): PresenceCode {
    return this.state.presenceCode;
  }

  /** La fin de la convention, ou `null` sans date ou sans créneau : voir `Convention.computeEnd()`. */
  get end(): LocalMoment | null {
    return Convention.computeEnd(
      this.state.date,
      this.day.timeSlots.map((slot) => slot.end),
    );
  }

  /** La convention est terminée dès sa fin. Sans fin, elle ne se termine pas. */
  hasEndedAt(now: LocalMoment): boolean {
    const end = this.end;
    if (!end) return false;
    if (now.date !== end.date) return now.date > end.date;
    return !now.time.isBefore(end.time);
  }

  /** Refuse ce que la convention ouvre au front office, une fois terminée. */
  verifyStillOpenAt(now: LocalMoment): void {
    if (this.hasEndedAt(now)) throw new Refusal('convention-ended', {});
  }

  /** Refuse un code qui n'est pas le code de présence (ID-2), et toute entrée une fois terminée. */
  verifyEntryAllowed(presented: string, now: LocalMoment): void {
    this.verifyStillOpenAt(now);
    if (!this.state.presenceCode.matchesPresentedCode(presented)) {
      throw new Refusal('presence-code-wrong', {});
    }
  }

  /**
   * S'identifier par un pseudo (ID-1), derrière le code de présence (ID-2). Un pseudo nouveau est
   * créé, sous l'identifiant `newParticipantId`, et donné à relier. Un pseudo existant, comparé
   * selon ID-7, demande d'abord une confirmation, celle d'un MJ si c'est le sien (ID-3), et n'est
   * donné à relier qu'avec elle : une simple question ne crée rien. Le pseudo d'un MJ est celui de
   * son participant : il n'en devient jamais un autre (ID-4, ADR 0012).
   */
  identifyByNickname(
    newParticipantId: string,
    presentedCode: string,
    nickname: string,
    confirmation: IdentityConfirmation | null,
    now: LocalMoment,
  ): Identification {
    this.verifyEntryAllowed(presentedCode, now);
    const typed = ComparableName.createFromText(nickname);
    const existing = this.allParticipants.findItemWithSameName(typed);
    if (!existing) {
      const participant = new Participant(newParticipantId, typed);
      this.allParticipants = this.allParticipants.getCollectionAfterAddingItem(participant);
      return { verdict: 'link', created: true, participant };
    }
    const expected = this.hasGameMasterRole(existing) ? 'game-master' : 'participant';
    if (confirmation !== expected) {
      return { verdict: 'confirm', confirmation: expected, nickname: existing.nickname.text };
    }
    return { verdict: 'link', created: false, participant: existing };
  }

  /** Les participants, MJ compris, dans l'ordre naturel de leur pseudo. */
  get participants(): readonly Participant[] {
    return this.allParticipants.itemsInNaturalOrder;
  }

  /** Le participant a un rôle de MJ (ADR 0012). */
  private hasGameMasterRole(participant: Participant): boolean {
    return this.findGameMasterOfParticipant(participant.id) !== undefined;
  }

  /** Le MJ du participant, ou `undefined` s'il n'en a pas le rôle (ADR 0012). */
  private findGameMasterOfParticipant(participantId: string): GameMaster | undefined {
    return this.allGameMasters.itemsInNaturalOrder.find(
      (gameMaster) => gameMaster.participant.id === participantId,
    );
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
  changeDate(date: string | null): void {
    this.state.date = date;
  }

  /** Les créneaux, dans l'ordre de la journée. */
  get timeSlots(): readonly TimeSlot[] {
    return this.day.timeSlots;
  }

  /** Rang du créneau dans la journée, à partir de 1 (PR-8). */
  getTimeSlotRank(timeSlotId: string): number {
    return this.day.getTimeSlotRank(timeSlotId);
  }

  addTimeSlot(id: string, start: TimeOfDay, end: TimeOfDay): void {
    this.day = this.verifyTwoSlotGamesStayConsecutive(
      this.day.getDayAfterAddingTimeSlot(id, start, end),
    );
  }

  /** Les heures d'un créneau qui porte une partie ou une disponibilité ne se modifient plus (PR-11). */
  changeTimeSlotHours(id: string, start: TimeOfDay, end: TimeOfDay): void {
    const current = this.day.findExistingTimeSlotById(id);
    if (current.start.equals(start) && current.end.equals(end)) return;
    const games = this.gameSchedule.countGamesOnTimeSlot(id);
    if (games > 0) {
      throw new Refusal('time-slot-hours-locked-by-games', {
        rank: this.getTimeSlotRank(id),
        games,
      });
    }
    const availabilities = this.countAvailabilitiesOnTimeSlot(id);
    if (availabilities > 0) {
      throw new Refusal('time-slot-hours-locked', {
        rank: this.getTimeSlotRank(id),
        availabilities,
      });
    }
    this.day = this.verifyTwoSlotGamesStayConsecutive(
      this.day.getDayAfterChangingTimeSlotHours(id, start, end),
    );
  }

  /**
   * Supprime un créneau, et les disponibilités qui s'y rattachent. Un créneau qui porte des parties
   * reste (PR-10).
   */
  removeTimeSlot(id: string): void {
    this.day.verifyTimeSlotExists(id);
    const games = this.gameSchedule.countGamesOnTimeSlot(id);
    if (games > 0)
      throw new Refusal('time-slot-has-games', { rank: this.getTimeSlotRank(id), games });
    this.day = this.day.getDayAfterRemovingTimeSlot(id);
    this.allGameMasters = this.allGameMasters.getCollectionAfterReplacingEachItem((gameMaster) =>
      gameMaster.getGameMasterAfterWithdrawingAvailability(id),
    );
  }

  /** Nombre de MJ disponibles sur le créneau. */
  countAvailabilitiesOnTimeSlot(timeSlotId: string): number {
    return this.allGameMasters.itemsInNaturalOrder.filter((gameMaster) =>
      gameMaster.isAvailableOnTimeSlot(timeSlotId),
    ).length;
  }

  /** Les tables, dans l'ordre naturel : « Table 2 » avant « Table 10 ». */
  get tables(): readonly Table[] {
    return this.allTables.itemsInNaturalOrder;
  }

  /** Ajoute une table, au nom obligatoire, borné et unique dans la convention (PR-9). */
  addTable(id: string, name: string): void {
    this.allTables = this.allTables.getCollectionAfterAddingItem(
      new Table(id, ComparableName.createFromText(name)),
    );
  }

  /** Renomme une table, même si elle porte des parties. */
  renameTable(id: string, name: string): void {
    this.allTables = this.allTables.getCollectionAfterReplacingItem(
      new Table(id, ComparableName.createFromText(name)),
    );
  }

  /** Supprime une table. Une table qui porte des parties reste (PR-10). */
  removeTable(id: string): void {
    const table = this.allTables.findExistingItemById(id);
    const games = this.gameSchedule.countGamesAtTable(id);
    if (games > 0) throw new Refusal('table-has-games', { name: table.name.text, games });
    this.allTables = this.allTables.getCollectionAfterRemovingItem(id);
  }

  /** Les MJ, dans l'ordre naturel de leur pseudo. */
  get gameMasters(): readonly GameMaster[] {
    return this.allGameMasters.itemsInNaturalOrder;
  }

  /**
   * Ajoute un MJ, avec son participant (`participantId`), au pseudo obligatoire, borné et unique
   * dans la convention, parmi les MJ comme parmi les participants (PR-12, ID-4, ID-7, ADR 0012).
   */
  addGameMaster(id: string, participantId: string, nickname: string): void {
    const gameMaster = new GameMaster(
      id,
      new Participant(participantId, ComparableName.createFromText(nickname)),
    );
    const gameMasters = this.allGameMasters.getCollectionAfterAddingItem(gameMaster);
    this.allParticipants = this.allParticipants.getCollectionAfterAddingItem(
      gameMaster.participant,
    );
    this.allGameMasters = gameMasters;
  }

  /**
   * Change le pseudo d'un MJ, à tout moment, aux mêmes règles qu'à sa création : celui de son
   * participant, dont les téléphones restent reliés (PR-12).
   */
  changeGameMasterNickname(id: string, nickname: string): void {
    const renamed = this.allGameMasters
      .findExistingItemById(id)
      .getGameMasterAfterChangingNickname(ComparableName.createFromText(nickname));
    const gameMasters = this.allGameMasters.getCollectionAfterReplacingItem(renamed);
    this.allParticipants = this.allParticipants.getCollectionAfterReplacingItem(
      renamed.participant,
    );
    this.allGameMasters = gameMasters;
  }

  /**
   * Supprime un MJ, et avec lui ses disponibilités et son participant, donc ses téléphones reliés et
   * ses inscriptions. Un MJ qui a au moins un scénario reste (PR-12) : le catalogue, entier, le dit.
   */
  removeGameMaster(id: string, catalogue: ScenarioCatalogue): void {
    const gameMaster = this.allGameMasters.findExistingItemById(id);
    const scenarios = catalogue.countScenariosOfGameMaster(id);
    if (scenarios > 0) throw new Refusal('game-master-has-scenarios', { scenarios });
    this.allGameMasters = this.allGameMasters.getCollectionAfterRemovingItem(id);
    this.allParticipants = this.allParticipants.getCollectionAfterRemovingItem(
      gameMaster.participant.id,
    );
    this.allSignUps = this.allSignUps.filter(
      (signUp) => signUp.participantId !== gameMaster.participant.id,
    );
  }

  /** Le MJ se déclare disponible sur un créneau existant (PR-2). Déclarer deux fois ne change rien. */
  declareGameMasterAvailability(gameMasterId: string, timeSlotId: string): void {
    const gameMaster = this.allGameMasters.findExistingItemById(gameMasterId);
    this.day.verifyTimeSlotExists(timeSlotId);
    this.allGameMasters = this.allGameMasters.getCollectionAfterReplacingItem(
      gameMaster.getGameMasterAfterDeclaringAvailability(timeSlotId),
    );
  }

  /**
   * Retire la disponibilité du MJ sur un créneau existant, sauf s'il y mène une partie (PR-15).
   * Retirer une absente ne change rien.
   */
  withdrawGameMasterAvailability(gameMasterId: string, timeSlotId: string): void {
    const gameMaster = this.allGameMasters.findExistingItemById(gameMasterId);
    this.day.verifyTimeSlotExists(timeSlotId);
    const refusal = this.findWithdrawalRefusal(gameMaster, timeSlotId);
    if (refusal) throw refusal;
    this.allGameMasters = this.allGameMasters.getCollectionAfterReplacingItem(
      gameMaster.getGameMasterAfterWithdrawingAvailability(timeSlotId),
    );
  }

  /**
   * Le verdict de retrait de chaque disponibilité du MJ, dans l'ordre de la journée : le refus que
   * `withdrawGameMasterAvailability()` y lèverait, ou `null`.
   */
  computeWithdrawalVerdicts(gameMasterId: string): WithdrawalVerdict[] {
    const gameMaster = this.allGameMasters.findExistingItemById(gameMasterId);
    return this.day.timeSlots
      .filter((slot) => gameMaster.isAvailableOnTimeSlot(slot.id))
      .map((slot) => ({
        timeSlotId: slot.id,
        refusal: this.findWithdrawalRefusal(gameMaster, slot.id),
      }));
  }

  /**
   * Fabrique le scénario d'un MJ existant, qui lui reste fixé (PR-16). La convention n'en garde
   * rien : le scénario est un agrégat à part (ADR 0005).
   */
  proposeScenario(id: string, gameMasterId: string, details: ScenarioDetails): Scenario {
    this.allGameMasters.verifyItemExists(gameMasterId);
    return Scenario.propose(id, gameMasterId, details);
  }

  /** Le scénario a au moins une partie programmée (PR-14). */
  isScenarioScheduled(scenarioId: string): boolean {
    return this.gameSchedule.isScenarioScheduled(scenarioId);
  }

  /** Le programme : les parties, dans l'ordre de leur programmation. */
  get games(): readonly Game[] {
    return this.gameSchedule.games;
  }

  /**
   * Programme le scénario sur un créneau et une table (PR-3), dans le respect de PR-5. Une partie
   * double se programme sur son premier créneau, et prend le suivant, à la même table. Les
   * inscriptions de son MJ sur ses créneaux restent, sans compter (IN-4). Rend « nouvelle partie »
   * et « tu mènes une partie » (`buildGamePlacedNotifications()`).
   */
  scheduleScenario(
    id: string,
    scenario: Scenario,
    timeSlotId: string,
    tableId: string,
  ): Notification[] {
    this.replaceScheduleAndPruneSignUps(
      this.throwIfRefused(
        this.getScheduleAfterSchedulingScenario(id, scenario, timeSlotId, tableId),
      ),
    );
    return this.buildGamePlacedNotifications([this.gameSchedule.findExistingGameById(id)], []);
  }

  /**
   * Déplace la partie sur un créneau et une table (PR-17), dans le respect de PR-5, sans compter la
   * partie elle-même. Une partie double se déplace par son premier créneau, et prend le suivant.
   * Elle reste la même partie, à son rang dans le programme. Sur un autre créneau, elle perd ses
   * inscriptions ; à une autre table du même créneau, elle les garde (IN-6). Sur un autre créneau,
   * rend « partie déplacée » à ses inscrits (`buildGameMovedNotifications()`), puis « nouvelle
   * partie » et « tu mènes une partie » (`buildGamePlacedNotifications()`).
   */
  moveGame(gameId: string, timeSlotId: string, tableId: string): Notification[] {
    const game = this.gameSchedule.findExistingGameById(gameId);
    const next = this.throwIfRefused(this.getScheduleAfterMovingGame(game, timeSlotId, tableId));
    const moved = this.buildGameMovedNotifications(next, [game]);
    this.replaceScheduleAndPruneSignUps(next);
    return [
      ...moved,
      ...this.buildGamePlacedNotifications(this.listGamesOnOtherTimeSlots([game]), moved),
    ];
  }

  /**
   * Échange deux parties (PR-17) : chacune prend le premier créneau et la table de l'autre, en un
   * seul geste. Les deux places sont vérifiées ensemble contre PR-5, sans compter les deux parties à
   * leur ancienne place. Chacune reste la même partie, à son rang dans le programme. Échangées entre
   * deux créneaux, elles perdent leurs inscriptions ; sur un même créneau, elles les gardent (IN-6).
   * Rend « partie déplacée » aux inscrits de chacune (`buildGameMovedNotifications()`) : un inscrit
   * aux deux en reçoit une par partie. Puis, pour chacune, « nouvelle partie » et « tu mènes une
   * partie » (`buildGamePlacedNotifications()`).
   */
  swapGames(gameId: string, otherGameId: string): Notification[] {
    const game = this.gameSchedule.findExistingGameById(gameId);
    const other = this.gameSchedule.findExistingGameById(otherGameId);
    const next = this.throwIfRefused(this.getScheduleAfterSwappingGames(game, other));
    const moved = this.buildGameMovedNotifications(next, [game, other]);
    this.replaceScheduleAndPruneSignUps(next);
    return [
      ...moved,
      ...this.buildGamePlacedNotifications(this.listGamesOnOtherTimeSlots([game, other]), moved),
    ];
  }

  /**
   * Déprogramme la partie (PR-17) : son scénario reste proposé, et revient dans la réserve. Elle
   * perd ses inscriptions (IN-6). Rend les notifications de ses inscrits et de son MJ (NO-2), qui
   * courent jusqu'à la fin de son dernier créneau (NO-3). Le MJ ne reçoit que la sienne : son
   * inscription à sa propre partie ne compte pas (IN-4, NO-1).
   */
  unscheduleGame(gameId: string): Notification[] {
    const game = this.gameSchedule.findExistingGameById(gameId);
    const signedUp = this.listCountedSignUpParticipantIds(game);
    this.replaceScheduleAndPruneSignUps(this.gameSchedule.getScheduleAfterUnschedulingGame(gameId));
    const params = { scenarioId: game.scenarioId, ranks: this.getTimeSlotRanks(game.timeSlotIds) };
    const deadline = this.computeEndOfTimeSlots(game.timeSlotIds);
    const gameMaster = this.allGameMasters.findExistingItemById(game.gameMasterId);
    const toGameMaster: Notification = {
      code: 'own-game-unscheduled',
      params,
      recipients: toParticipantRecipients([gameMaster.participant.id]),
      deadline,
    };
    if (!signedUp.length) return [toGameMaster];
    return [
      { code: 'game-unscheduled', params, recipients: toParticipantRecipients(signedUp), deadline },
      toGameMaster,
    ];
  }

  /**
   * Le verdict de chaque case créneaux × tables pour le scénario : le refus que `scheduleScenario()` y
   * lèverait, ou `null`. Dans l'ordre des créneaux, puis des tables.
   */
  computePlacementVerdicts(scenario: Scenario): Placement[] {
    return this.day.timeSlots.flatMap((slot) =>
      this.tables.map((table) => ({
        timeSlotId: slot.id,
        tableId: table.id,
        refusal: this.extractRefusal(
          this.getScheduleAfterSchedulingScenario(
            HYPOTHETICAL_GAME_ID,
            scenario,
            slot.id,
            table.id,
          ),
        ),
      })),
    );
  }

  /**
   * Le verdict de chaque case créneaux × tables pour déplacer la partie, dans l'ordre des créneaux,
   * puis des tables. La première case d'une autre partie propose de l'échanger avec elle
   * (`swapWith`), avec le refus que `swapGames()` lèverait ; toute autre case, le refus que
   * `moveGame()` y lèverait. Sa propre case est permise.
   */
  computeMoveVerdicts(gameId: string): MovePlacement[] {
    const game = this.gameSchedule.findExistingGameById(gameId);
    return this.day.timeSlots.flatMap((slot) =>
      this.tables.map((table) => {
        const other = this.gameSchedule.findOtherGameStartingAt(game, slot.id, table.id);
        return {
          timeSlotId: slot.id,
          tableId: table.id,
          swapWith: other?.id ?? null,
          refusal: this.extractRefusal(
            other
              ? this.getScheduleAfterSwappingGames(game, other)
              : this.getScheduleAfterMovingGame(game, slot.id, table.id),
          ),
        };
      }),
    );
  }

  /** La réserve (PR-6) : voir `computeReserve()`. */
  computeReserve(catalogue: ScenarioCatalogue): ReserveOfScenario[] {
    return computeReserve(catalogue, this.day, this.gameSchedule, this.allGameMasters);
  }

  /** Les inscriptions, dans l'ordre où elles ont été prises. */
  get signUps(): readonly SignUp[] {
    return this.allSignUps;
  }

  /**
   * Inscrit le participant à la partie (IN-2), tant que le tirage de son créneau n'est pas lancé.
   * Plusieurs inscriptions sur un même créneau sont permises. Une partie double compte sur ses deux
   * créneaux, et ne touche pas aux inscriptions prises sur son second créneau (IN-3, TI-3). Un MJ
   * ne s'inscrit pas sur un créneau où il mène, sa propre partie comprise (IN-4). Le catalogue, entier,
   * donne les places maximum de la partie. Rend « partie très demandée » si l'inscription la fait
   * passer au-dessus, pour ses autres inscrits (NO-2), ou `null` si le participant y était déjà
   * inscrit : rien ne change.
   */
  signUpForGame(
    participantId: string,
    gameId: string,
    catalogue: ScenarioCatalogue,
  ): Notification[] | null {
    const signUp = this.buildSignUpIfOpen(participantId, gameId);
    this.verifyNotLeadingDuringGame(participantId, signUp.gameId);
    if (this.allSignUps.some((existing) => existing.equals(signUp))) return null;
    this.allSignUps = [...this.allSignUps, signUp];
    const game = this.gameSchedule.findExistingGameById(gameId);
    const { maxSeats } = catalogue.findExistingEntryById(game.scenarioId);
    if (this.listCountedSignUpParticipantIds(game).length !== maxSeats + 1) return [];
    return this.buildOversubscribedNotifications(game, participantId);
  }

  /**
   * « Partie très demandée » pour chaque partie du scénario que la baisse de ses places, depuis
   * `previousSeats`, fait passer au-dessus du maximum, avant le tirage de son créneau (NO-2, PR-4).
   * La convention n'en change pas : le scénario est un autre agrégat (ADR 0010).
   */
  buildOversubscribedNotificationsAfterSeatsChange(
    scenario: Scenario,
    previousSeats: Seats,
  ): Notification[] {
    return this.gameSchedule.games
      .filter((game) => game.scenarioId === scenario.id)
      .filter((game) => this.getTimeSlotState(game.timeSlotIds[0]!) === 'sign-ups-open')
      .filter((game) => {
        const count = this.listCountedSignUpParticipantIds(game).length;
        return count > scenario.seats.max && count <= previousSeats.max;
      })
      .flatMap((game) => this.buildOversubscribedNotifications(game, null));
  }

  /**
   * Retire l'inscription du participant à la partie (IN-2), tant que le tirage de son créneau n'est
   * pas lancé. Rend `false` s'il n'y était pas inscrit : rien ne change.
   */
  withdrawFromGame(participantId: string, gameId: string): boolean {
    const signUp = this.buildSignUpIfOpen(participantId, gameId);
    const remaining = this.allSignUps.filter((existing) => !existing.equals(signUp));
    if (remaining.length === this.allSignUps.length) return false;
    this.allSignUps = remaining;
    return true;
  }

  /**
   * La situation du participant : ses inscriptions, sauf celles qui ne comptent pas (IN-4), puis
   * l'état de chaque créneau, dans l'ordre de la journée, avec la partie qu'y mène son MJ et le
   * résultat de son tirage.
   */
  computeParticipantSituation(participantId: string): ParticipantSituation {
    const participant = this.allParticipants.findExistingItemById(participantId);
    return {
      signedUpGameIds: this.allSignUps
        .filter(
          (signUp) => signUp.participantId === participant.id && !this.isSignUpSuspended(signUp),
        )
        .map(({ gameId }) => gameId),
      timeSlots: this.day.timeSlots.map((slot) => ({
        timeSlotId: slot.id,
        state: this.getTimeSlotState(slot.id),
        ledGameId: this.findGameLedByParticipantOnTimeSlot(participant.id, slot.id)?.id ?? null,
        // Le tirage n'existe pas encore : aucun résultat.
        drawResult: null,
      })),
    };
  }

  /** La partie que mène le MJ du participant sur ce créneau, ou `undefined` (ADR 0012). */
  private findGameLedByParticipantOnTimeSlot(
    participantId: string,
    timeSlotId: string,
  ): Game | undefined {
    const gameMaster = this.findGameMasterOfParticipant(participantId);
    return (
      gameMaster && this.gameSchedule.findGameLedByGameMasterOnTimeSlot(gameMaster.id, timeSlotId)
    );
  }

  /**
   * Refuse l'inscription d'un MJ à une partie dont l'un des créneaux est un de ceux où il mène
   * (IN-4), avec le créneau et la table de sa partie.
   */
  private verifyNotLeadingDuringGame(participantId: string, gameId: string): void {
    for (const slotId of this.gameSchedule.findExistingGameById(gameId).timeSlotIds) {
      const run = this.findGameLedByParticipantOnTimeSlot(participantId, slotId);
      if (!run) continue;
      throw new Refusal('leads-game-on-time-slot', {
        rank: this.getTimeSlotRank(slotId),
        table: this.allTables.findExistingItemById(run.tableId).name.text,
      });
    }
  }

  /** L'inscription ne compte pas : voir `Convention.isSignUpSuspended()`. */
  private isSignUpSuspended(signUp: SignUp): boolean {
    const gameMaster = this.findGameMasterOfParticipant(signUp.participantId);
    if (!gameMaster) return false;
    return Convention.isSignUpSuspendedByLedTimeSlots(
      this.gameSchedule.findExistingGameById(signUp.gameId).timeSlotIds,
      this.gameSchedule.listTimeSlotIdsLedByGameMaster(gameMaster.id),
    );
  }

  /**
   * « Partie déplacée » pour chacune de ces parties qui passe à d'autres créneaux dans `next`, à ses
   * inscrits dont l'inscription compte (IN-4, IN-6). Elle court jusqu'à la fin du plus tardif de ses
   * anciens et nouveaux créneaux (NO-3). À lire avant le remplacement : il efface ces inscriptions.
   */
  private buildGameMovedNotifications(next: Schedule, games: readonly Game[]): Notification[] {
    return games.flatMap((game) => {
      const signedUp = this.listCountedSignUpParticipantIds(game);
      if (next.hasGameOnSameTimeSlots(game) || !signedUp.length) return [];
      const moved = next.findExistingGameById(game.id);
      return [
        {
          code: 'game-moved',
          params: {
            gameId: game.id,
            scenarioId: game.scenarioId,
            fromRanks: this.getTimeSlotRanks(game.timeSlotIds),
            toRanks: this.getTimeSlotRanks(moved.timeSlotIds),
          },
          recipients: toParticipantRecipients(signedUp),
          deadline: this.computeEndOfTimeSlots([...game.timeSlotIds, ...moved.timeSlotIds]),
        },
      ];
    });
  }

  /**
   * Pour chacune de ces parties, à sa place dans le Programme : « tu mènes une partie » à son MJ, et,
   * avant la publication de son créneau, « nouvelle partie » à tous ceux qui peuvent s'y inscrire.
   * En sont écartés les MJ qui mènent sur l'un de ses créneaux (IN-4), et ceux qui reçoivent du même
   * geste une notification plus précise : « tu mènes une partie », ou l'une de `moreSpecific`
   * (NO-1). Les joueurs d'une partie double publiée qui occupe le créneau le seront aussi, quand le
   * tirage existera. Chacune court jusqu'à la fin du dernier créneau de sa partie (NO-3).
   */
  private buildGamePlacedNotifications(
    games: readonly Game[],
    moreSpecific: readonly Notification[],
  ): Notification[] {
    const placed = games.map((game) => ({
      game,
      ranks: this.getTimeSlotRanks(game.timeSlotIds),
      tableName: this.allTables.findExistingItemById(game.tableId).name.text,
      deadline: this.computeEndOfTimeSlots(game.timeSlotIds),
      gameMasterParticipantId: this.allGameMasters.findExistingItemById(game.gameMasterId)
        .participant.id,
    }));
    const excluded = [
      ...moreSpecific.flatMap(({ recipients }) => recipients.participantIds),
      ...placed.map(({ gameMasterParticipantId }) => gameMasterParticipantId),
    ];
    const newGames = placed
      .filter(({ game }) => this.getTimeSlotState(game.timeSlotIds[0]!) !== 'published')
      .map(({ game, ranks, tableName, deadline }): Notification => ({
        code: 'new-game',
        params: { gameId: game.id, scenarioId: game.scenarioId, ranks, tableName },
        recipients: {
          kind: 'everyone-except',
          participantIds: [
            ...new Set([
              ...this.listParticipantIdsLeadingOnTimeSlots(game.timeSlotIds),
              ...excluded,
            ]),
          ],
        },
        deadline,
      }));
    const toGameMasters = placed.map(
      ({ game, ranks, tableName, deadline, gameMasterParticipantId }): Notification => ({
        code: 'own-game-scheduled',
        params: {
          scenarioId: game.scenarioId,
          ranks,
          tableName,
          start: this.day.findExistingTimeSlotById(game.timeSlotIds[0]!).start.toString(),
          end: this.day.findExistingTimeSlotById(game.timeSlotIds.at(-1)!).end.toString(),
        },
        recipients: toParticipantRecipients([gameMasterParticipantId]),
        deadline,
      }),
    );
    return [...newGames, ...toGameMasters];
  }

  /** Celles de ces parties qui ne sont plus sur les mêmes créneaux, telles que le Programme les a. */
  private listGamesOnOtherTimeSlots(previous: readonly Game[]): Game[] {
    return previous
      .filter((game) => !this.gameSchedule.hasGameOnSameTimeSlots(game))
      .map((game) => this.gameSchedule.findExistingGameById(game.id));
  }

  /** Les participants des MJ qui mènent sur l'un de ces créneaux, dans l'ordre naturel de leur pseudo. */
  private listParticipantIdsLeadingOnTimeSlots(timeSlotIds: readonly string[]): string[] {
    return this.allGameMasters.itemsInNaturalOrder
      .filter((gameMaster) =>
        timeSlotIds.some((slotId) =>
          this.gameSchedule.isGameMasterLeadingOnTimeSlot(gameMaster.id, slotId),
        ),
      )
      .map((gameMaster) => gameMaster.participant.id);
  }

  /**
   * « Partie très demandée » à ses inscrits dont c'est la seule inscription sur son créneau, sauf
   * `authorId`, l'auteur de l'inscription qui l'y fait passer : il vient de voir la confirmation
   * (IN-5). Une partie double ne compte que sur son premier créneau. Rien sans destinataire.
   */
  private buildOversubscribedNotifications(game: Game, authorId: string | null): Notification[] {
    const firstTimeSlotId = game.timeSlotIds[0]!;
    const recipients = this.listCountedSignUpParticipantIds(game).filter(
      (participantId) =>
        participantId !== authorId &&
        !this.allSignUps.some(
          (signUp) =>
            signUp.participantId === participantId &&
            signUp.gameId !== game.id &&
            this.gameSchedule.findExistingGameById(signUp.gameId).timeSlotIds[0] ===
              firstTimeSlotId &&
            !this.isSignUpSuspended(signUp),
        ),
    );
    if (!recipients.length) return [];
    return [
      {
        code: 'game-oversubscribed',
        params: { scenarioId: game.scenarioId, rank: this.getTimeSlotRank(firstTimeSlotId) },
        recipients: toParticipantRecipients(recipients),
        deadline: this.computeEndOfTimeSlots(game.timeSlotIds),
      },
    ];
  }

  /** Les participants inscrits à la partie, dans l'ordre de leur inscription, sauf ceux dont l'inscription ne compte pas (IN-4). */
  private listCountedSignUpParticipantIds(game: Game): string[] {
    return this.allSignUps
      .filter((signUp) => signUp.gameId === game.id && !this.isSignUpSuspended(signUp))
      .map(({ participantId }) => participantId);
  }

  /** Les rangs des créneaux, dans l'ordre donné. */
  private getTimeSlotRanks(timeSlotIds: readonly string[]): number[] {
    return timeSlotIds.map((slotId) => this.getTimeSlotRank(slotId));
  }

  /** La fin du dernier de ces créneaux, le jour de la convention, ou `null` sans date. */
  private computeEndOfTimeSlots(timeSlotIds: readonly string[]): LocalMoment | null {
    return Convention.computeEnd(
      this.state.date,
      timeSlotIds.map((slotId) => this.day.findExistingTimeSlotById(slotId).end),
    );
  }

  /** L'état du créneau. Le tirage n'existant pas encore, ses inscriptions restent ouvertes. */
  private getTimeSlotState(_timeSlotId: string): TimeSlotState {
    return 'sign-ups-open';
  }

  /**
   * L'inscription du participant à la partie, qui doivent exister, ou le refus du geste : le tirage
   * de son créneau est lancé. Une partie double est tirée avec son premier créneau (TI-3).
   */
  private buildSignUpIfOpen(participantId: string, gameId: string): SignUp {
    const participant = this.allParticipants.findExistingItemById(participantId);
    const game = this.gameSchedule.findExistingGameById(gameId);
    const firstTimeSlotId = game.timeSlotIds[0]!;
    if (this.getTimeSlotState(firstTimeSlotId) !== 'sign-ups-open') {
      throw new Refusal('sign-ups-closed', { rank: this.getTimeSlotRank(firstTimeSlotId) });
    }
    return new SignUp(participant.id, game.id);
  }

  /** Le Programme après la programmation du scénario sur cette case, ou le refus de PR-5. */
  private getScheduleAfterSchedulingScenario(
    id: string,
    scenario: Scenario,
    timeSlotId: string,
    tableId: string,
  ): Schedule | Refusal {
    this.day.verifyTimeSlotExists(timeSlotId);
    return this.gameSchedule.getScheduleAfterSchedulingScenario(
      id,
      scenario,
      timeSlotId,
      this.findExistingGameMasterAndTable(scenario.gameMasterId, tableId),
      this.day,
    );
  }

  /** Le Programme après le déplacement de la partie sur cette case, ou le refus de PR-5. */
  private getScheduleAfterMovingGame(
    game: Game,
    timeSlotId: string,
    tableId: string,
  ): Schedule | Refusal {
    this.day.verifyTimeSlotExists(timeSlotId);
    return this.gameSchedule.getScheduleAfterMovingGame(
      game,
      timeSlotId,
      this.findExistingGameMasterAndTable(game.gameMasterId, tableId),
      this.day,
    );
  }

  /** Le Programme après l'échange des deux parties, ou le refus de PR-5. */
  private getScheduleAfterSwappingGames(game: Game, other: Game): Schedule | Refusal {
    return this.gameSchedule.getScheduleAfterSwappingGames(
      game,
      this.findExistingGameMasterAndTable(game.gameMasterId, other.tableId),
      other,
      this.findExistingGameMasterAndTable(other.gameMasterId, game.tableId),
      this.day,
    );
  }

  /** Le MJ et la table d'une partie, qui doivent exister. */
  private findExistingGameMasterAndTable(
    gameMasterId: string,
    tableId: string,
  ): PlacementCollaborators {
    const table = this.allTables.findExistingItemById(tableId);
    return { gameMaster: this.allGameMasters.findExistingItemById(gameMasterId), table };
  }

  /**
   * Remplace le Programme. Une partie déprogrammée, ou qui passe sur d'autres créneaux, perd ses
   * inscriptions ; changer de table les garde (IN-6).
   */
  private replaceScheduleAndPruneSignUps(next: Schedule): void {
    this.allSignUps = this.allSignUps.filter(({ gameId }) =>
      next.hasGameOnSameTimeSlots(this.gameSchedule.findExistingGameById(gameId)),
    );
    this.gameSchedule = next;
  }

  /** Le Programme accepté, ou lève son refus. */
  private throwIfRefused(result: Schedule | Refusal): Schedule {
    if (result instanceof Refusal) throw result;
    return result;
  }

  /** Le refus d'un geste, ou `null` s'il est permis : le verdict. */
  private extractRefusal(result: Schedule | Refusal): Refusal | null {
    return result instanceof Refusal ? result : null;
  }

  /** La règle PR-15 du retrait d'une disponibilité, la même pour l'écriture et pour le verdict. */
  private findWithdrawalRefusal(gameMaster: GameMaster, timeSlotId: string): Refusal | null {
    if (!this.gameSchedule.isGameMasterLeadingOnTimeSlot(gameMaster.id, timeSlotId)) return null;
    return new Refusal('availability-has-game', {
      nickname: gameMaster.nickname.text,
      rank: this.getTimeSlotRank(timeSlotId),
    });
  }

  /** Refuse une journée qui couperait une partie double (PR-11), et la renvoie sinon. */
  private verifyTwoSlotGamesStayConsecutive(nextDay: Day): Day {
    this.gameSchedule.verifyTwoSlotGamesStayConsecutive(this.day, nextDay);
    return nextDay;
  }
}

/** Des destinataires désignés par leur identifiant de participant. */
function toParticipantRecipients(participantIds: string[]): Notification['recipients'] {
  return { kind: 'participants', participantIds };
}

/** L'id d'une partie qui n'existera pas : un verdict ne programme rien. */
const HYPOTHETICAL_GAME_ID = '';

/**
 * La réponse « oui » à la confirmation d'un pseudo existant : « Est-ce bien toi qui l'as créé ? »
 * pour un participant (ID-1), « Es-tu bien ce MJ ? » pour un MJ (ID-3).
 */
export type IdentityConfirmation = 'participant' | 'game-master';

/**
 * Le verdict d'une identification : le participant à relier au téléphone, MJ ou non (`created` s'il
 * vient d'être créé), ou la confirmation à demander, avec le pseudo existant tel qu'il s'affiche.
 */
export type Identification =
  | { verdict: 'link'; created: boolean; participant: Participant }
  | { verdict: 'confirm'; confirmation: IdentityConfirmation; nickname: string };

/**
 * L'état d'un créneau : inscriptions ouvertes, tirage lancé (inscriptions fermées, résultat
 * provisoire), ou tirage publié (résultat figé).
 */
export type TimeSlotState = 'sign-ups-open' | 'drawing' | 'published';

/**
 * Le résultat publié du tirage d'un créneau pour un participant : sa partie (`assigned`), ou pas de
 * place (`unassigned`). Pour un MJ, sur le créneau où commence sa partie : ses joueurs, dans l'ordre
 * naturel de leur pseudo (`leading`), ou sa partie annulée (`cancelled`, TI-6). `null` tant que le
 * tirage n'est pas publié, ou sans inscription.
 */
export type DrawResult =
  | { kind: 'assigned'; gameId: string }
  | { kind: 'unassigned' }
  | { kind: 'leading'; players: string[] }
  | { kind: 'cancelled' }
  | null;

/** La situation d'un participant : voir `Convention.computeParticipantSituation()`. */
export type ParticipantSituation = {
  signedUpGameIds: string[];
  timeSlots: {
    timeSlotId: string;
    state: TimeSlotState;
    /** La partie que mène son MJ sur ce créneau, les deux d'une partie double, ou `null` (IN-4). */
    ledGameId: string | null;
    drawResult: DrawResult;
  }[];
};

/** Le verdict d'une case créneau × table pour un scénario : le refus d'écriture, ou `null`. */
export type Placement = { timeSlotId: string; tableId: string; refusal: Refusal | null };

/**
 * Le verdict d'une case créneau × table pour déplacer une partie : `swapWith`, l'id de la partie
 * avec laquelle l'échanger, ou `null` pour un déplacement ; le refus d'écriture, ou `null`.
 */
export type MovePlacement = Placement & { swapWith: string | null };

/** Le verdict de retrait d'une disponibilité : le refus d'écriture, ou `null`. */
export type WithdrawalVerdict = { timeSlotId: string; refusal: Refusal | null };

/** Le nom d'une table : obligatoire, borné, unique dans la convention (PR-9). */
const TABLE_NAMING_RULES: NamingRules<Table> = {
  getName: (table) => table.name,
  maxLength: Convention.TABLE_NAME_MAX_LENGTH,
  refuseMissingItem: () => new Refusal('table-not-found', {}),
  refuseEmptyName: () => new Refusal('table-name-required', {}),
  refuseTooLongName: (max) => new Refusal('table-name-too-long', { max }),
  refuseTakenName: (namesake) => new Refusal('table-name-taken', { name: namesake.name.text }),
};

/**
 * Le pseudo d'un MJ : obligatoire, borné, unique parmi les MJ (PR-12, ID-7). Vérifié avant celui de
 * son participant, il donne son motif au refus d'un pseudo de MJ.
 */
const NICKNAME_RULES: NamingRules<GameMaster> = {
  getName: (gameMaster) => gameMaster.nickname,
  maxLength: Convention.NICKNAME_MAX_LENGTH,
  refuseMissingItem: () => new Refusal('game-master-not-found', {}),
  refuseEmptyName: () => new Refusal('nickname-required', {}),
  refuseTooLongName: (max) => new Refusal('nickname-too-long', { max }),
  refuseTakenName: (namesake) =>
    new Refusal('nickname-taken', { nickname: namesake.nickname.text }),
};

/**
 * Le pseudo d'un participant, MJ compris : obligatoire, borné, unique parmi les participants (ID-1,
 * ID-4, ID-7). `identifyByNickname()` relie un pseudo déjà pris au lieu de le refuser ; seuls l'ajout et le
 * renommage d'un MJ le refusent, une fois écarté un autre MJ (PR-12).
 */
const PARTICIPANT_NICKNAME_RULES: NamingRules<Participant> = {
  getName: (participant) => participant.nickname,
  maxLength: Convention.NICKNAME_MAX_LENGTH,
  refuseMissingItem: () => new Refusal('participant-not-found', {}),
  refuseEmptyName: () => new Refusal('nickname-required', {}),
  refuseTooLongName: (max) => new Refusal('nickname-too-long', { max }),
  refuseTakenName: (namesake) =>
    new Refusal('nickname-taken-by-participant', { nickname: namesake.nickname.text }),
};
