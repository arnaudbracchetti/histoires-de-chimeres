import { ComparableName } from '../comparable-name.js';
import { buildParticipantRecipients, type Notification } from '../notification.js';
import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type ScenarioDetails } from '../scenario/scenario.js';
import type { Seats } from '../scenario/seats.js';
import { Day } from './day.js';
import type { Draw } from './draw.js';
import type { DrawAlgorithm, RandomSource } from './draw-algorithm.js';
import {
  buildDrawPublicationNotifications,
  buildLatecomerNotification,
} from './draw-publication.js';
import { Draws, type DrawCollaborators, type LatecomerCollaborators } from './draws.js';
import type { Game } from './game.js';
import { LedGames } from './led-games.js';
import type { GameMaster } from './game-master.js';
import { computeLatestEnd, isReachedAt, type LocalMoment } from './local-moment.js';
import type { Participant } from './participant.js';
import { ParticipantWithoutGame } from './participant-without-game.js';
import { Participants } from './participants.js';
import type { PresenceCode } from './presence-code.js';
import { Table } from './table.js';
import { computeReserve, computeReserveOfTimeSlot, type ReserveOfScenario } from './reserve.js';
import {
  HYPOTHETICAL_GAME_ID,
  Schedule,
  type PlacementCollaborators,
  type SchedulableScenario,
} from './schedule.js';
import { ScheduleChange } from './schedule-change.js';
import { SignUp } from './sign-up.js';
import { computeSignUpTracking, type TimeSlotTracking } from './sign-up-tracking.js';
import {
  SignUps,
  type MergeOutcome,
  type PlayedTimeSlots,
  type RemovedSignUps,
  type SignUpCollaborators,
  type SignUpMergeCollaborators,
  type SignUpMergeOutcome,
} from './sign-ups.js';
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
  /** Dans n'importe quel ordre. */
  participantsWithoutGame: ParticipantWithoutGame[];
  /** Les tirages lancés, un par créneau, dans n'importe quel ordre. */
  draws: Draw[];
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
  static readonly NICKNAME_MAX_LENGTH = Participants.NICKNAME_MAX_LENGTH;

  /**
   * La fin de la convention : la fin de son dernier créneau, le jour de sa date. Sans date ou sans
   * créneau, elle n'en a pas : les Organisateurs testent le front office avant le jour J. Les créneaux
   * ne se chevauchent pas, donc le dernier est celui qui finit le plus tard. Statique pour que la
   * lecture la calcule sans charger l'agrégat.
   */
  static computeEnd(date: string | null, timeSlotEnds: readonly TimeOfDay[]): LocalMoment | null {
    return computeLatestEnd(date, timeSlotEnds);
  }

  private constructor(
    private state: Pick<ConventionState, 'id' | 'name' | 'date' | 'version' | 'presenceCode'>,
    private day: Day,
    private allTables: UniquelyNamedCollection<Table>,
    private allParticipants: Participants,
    private gameSchedule: Schedule,
    private allSignUps: SignUps,
    private allDraws: Draws,
  ) {}

  static restore({
    timeSlots,
    tables,
    gameMasters,
    participants,
    signUps,
    participantsWithoutGame,
    draws,
    games,
    ...state
  }: ConventionState): Convention {
    return new Convention(
      state,
      Day.createFromTimeSlots(timeSlots),
      UniquelyNamedCollection.createFromItems(tables, TABLE_NAMING_RULES),
      Participants.createFromParticipantsAndGameMasters(participants, gameMasters),
      Schedule.createFromGames(games),
      SignUps.createFromSignUps(signUps, participantsWithoutGame),
      Draws.createFromDraws(draws),
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
    return isReachedAt(this.end, now);
  }

  /**
   * Le créneau est terminé : son tirage est publié, et son heure de fin passée, le jour de la
   * convention. Sans date, jamais.
   */
  hasTimeSlotEndedAt(timeSlotId: string, now: LocalMoment): boolean {
    return this.allDraws.hasTimeSlotEndedAt(timeSlotId, now, this.day, this.state.date);
  }

  /** L'état du créneau à cet instant : l'avancement de son tirage, ou « terminé ». */
  computeTimeSlotStateAt(timeSlotId: string, now: LocalMoment): TimeSlotState {
    return this.hasTimeSlotEndedAt(timeSlotId, now) ? 'ended' : this.getDrawStage(timeSlotId);
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
    const identification = this.allParticipants.computeIdentification(
      newParticipantId,
      nickname,
      confirmation,
    );
    if (identification.verdict === 'link' && identification.created) {
      this.allParticipants = this.allParticipants.getParticipantsAfterAddingParticipant(
        identification.participant,
      );
    }
    return identification;
  }

  /**
   * Un Organisateur crée un pseudo de participant, à tout moment, pour une personne sans téléphone
   * (ID-12). Le pseudo est obligatoire, borné et unique selon ID-7, parmi les participants comme
   * parmi les MJ (ID-4) : un pseudo pris est refusé, avec l'identifiant de son participant, sans
   * confirmation. Un téléphone s'y relie ensuite comme à tout pseudo existant (ID-1).
   */
  addParticipant(participantId: string, nickname: string): void {
    this.allParticipants = this.allParticipants.getParticipantsAfterCreatingParticipantByOrganizer(
      participantId,
      nickname,
    );
  }

  /**
   * Renomme un pseudo, de participant ou de MJ, à tout moment, même après la publication (ID-13) :
   * même règle qu'à sa création (ID-4, ID-7), le même pseudo autrement écrit compris. Le participant
   * garde ses liens, ses inscriptions et ses résultats ; l'ancien pseudo redevient libre. Personne
   * n'est notifié (NO-4).
   */
  renameParticipant(participantId: string, nickname: string): void {
    this.allParticipants = this.allParticipants.getParticipantsAfterRenamingParticipant(
      participantId,
      nickname,
    );
  }

  /** Refuse un participant inconnu, MJ compris. */
  verifyParticipantExists(participantId: string): void {
    this.allParticipants.verifyParticipantExists(participantId);
  }

  /** Les participants, MJ compris, dans l'ordre naturel de leur pseudo. */
  get participants(): readonly Participant[] {
    return this.allParticipants.participants;
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

  /**
   * Ajoute un créneau, qui doit tenir dans la journée sans couper une partie double, ni se placer
   * avant un créneau tiré (PR-11).
   */
  addTimeSlot(id: string, start: TimeOfDay, end: TimeOfDay): void {
    const nextDay = this.verifyTwoSlotGamesStayConsecutive(
      this.day.getDayAfterAddingTimeSlot(id, start, end),
    );
    this.allDraws.verifyNoDrawAfterTimeSlot(id, this.day, nextDay);
    this.day = nextDay;
  }

  /**
   * Les heures d'un créneau qui porte une partie ou une disponibilité, ou dont le tirage est lancé,
   * ne se modifient plus ; un créneau ne se déplace pas avant un créneau tiré (PR-11).
   */
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
    this.allDraws.verifyTimeSlotNotDrawn(id, this.day);
    const nextDay = this.verifyTwoSlotGamesStayConsecutive(
      this.day.getDayAfterChangingTimeSlotHours(id, start, end),
    );
    this.allDraws.verifyNoDrawAfterTimeSlot(id, this.day, nextDay);
    this.day = nextDay;
  }

  /**
   * Supprime un créneau, et les disponibilités et les participants sans partie qui s'y rattachent.
   * Un créneau qui porte des parties, ou dont le tirage est lancé, reste (PR-10).
   */
  removeTimeSlot(id: string): void {
    this.day.verifyTimeSlotExists(id);
    const games = this.gameSchedule.countGamesOnTimeSlot(id);
    if (games > 0)
      throw new Refusal('time-slot-has-games', { rank: this.getTimeSlotRank(id), games });
    this.allDraws.verifyTimeSlotNotDrawn(id, this.day);
    this.day = this.day.getDayAfterRemovingTimeSlot(id);
    this.allParticipants =
      this.allParticipants.getParticipantsAfterWithdrawingAvailabilitiesOnTimeSlot(id);
    this.allSignUps = this.allSignUps.getSignUpsAfterRemovingTimeSlot(id);
  }

  /** Nombre de MJ disponibles sur le créneau. */
  countAvailabilitiesOnTimeSlot(timeSlotId: string): number {
    return this.allParticipants.countAvailabilitiesOnTimeSlot(timeSlotId);
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
    return this.allParticipants.gameMasters;
  }

  /**
   * Ajoute un MJ, avec son participant (`participantId`), au pseudo obligatoire, borné et unique
   * dans la convention, parmi les MJ comme parmi les participants (PR-12, ID-4, ID-7, ADR 0012).
   */
  addGameMaster(id: string, participantId: string, nickname: string): void {
    this.allParticipants = this.allParticipants.getParticipantsAfterAddingGameMaster(
      id,
      participantId,
      nickname,
    );
  }

  /**
   * Change le pseudo d'un MJ : celui de son participant, renommé par la règle de
   * `renameParticipant()` (PR-12, ID-13).
   */
  changeGameMasterNickname(id: string, nickname: string): void {
    this.allParticipants = this.allParticipants.getParticipantsAfterChangingGameMasterNickname(
      id,
      nickname,
    );
  }

  /** Le participant a le rôle MJ (ADR 0012). */
  isParticipantGameMaster(participantId: string): boolean {
    return this.allParticipants.findGameMasterOfParticipant(participantId) !== undefined;
  }

  /**
   * Donne le rôle MJ à un participant existant, sous l'identifiant `id` (ID-4, ID-16) : il garde
   * ses liens et ses inscriptions, et IN-4 s'applique dès lors. Donner le rôle à un MJ ne change
   * rien.
   */
  appointGameMaster(id: string, participantId: string): void {
    this.allParticipants = this.allParticipants.getParticipantsAfterAppointingGameMaster(
      id,
      participantId,
    );
  }

  /**
   * Retire le rôle MJ à un participant (ID-16, PR-12) : ses disponibilités sont supprimées, son
   * participant reste, avec ses liens et ses inscriptions. Refusé tant que le MJ a un scénario : le
   * catalogue, entier, le dit. Sans scénario, le MJ ne mène aucune partie. Retirer le rôle à un
   * participant qui ne l'a pas ne change rien.
   */
  withdrawGameMasterRole(participantId: string, catalogue: ScenarioCatalogue): void {
    this.allParticipants = this.allParticipants.getParticipantsAfterWithdrawingGameMasterRole(
      participantId,
      catalogue,
    );
  }

  /**
   * Supprime un MJ, et avec lui ses disponibilités et son participant, donc ses téléphones reliés,
   * ses inscriptions, son état sans partie et ses affectations de tous les tirages. Un MJ qui a au
   * moins un scénario reste (PR-12) : le catalogue, entier, le dit.
   */
  removeGameMaster(id: string, catalogue: ScenarioCatalogue): void {
    const participantId = this.allParticipants.findExistingGameMasterById(id).participant.id;
    this.allParticipants = this.allParticipants.getParticipantsAfterRemovingGameMaster(
      id,
      catalogue,
    );
    this.removeParticipantFromSignUpsAndDraws(participantId);
  }

  /**
   * Supprime un pseudo de participant, à tout moment, même après la publication (ID-10) : il perd
   * ses téléphones reliés, ses inscriptions, son état sans partie et son résultat dans tous les
   * tirages, puis son pseudo redevient libre. Une partie publiée compte un joueur de moins, sans
   * proposer la place à personne. Un MJ est refusé : il se supprime par `removeGameMaster()`
   * (PR-12). Personne n'est notifié (NO-4).
   */
  removeParticipant(participantId: string): void {
    this.allParticipants =
      this.allParticipants.getParticipantsAfterRemovingParticipant(participantId);
    this.removeParticipantFromSignUpsAndDraws(participantId);
  }

  /**
   * Fusionne le pseudo source dans le pseudo destination, à tout moment (ID-11) : la destination
   * reçoit ses inscriptions, son état sans partie et ses affectations, selon les règles des
   * Inscriptions et des Tirages, lues sur l'état d'avant la fusion. La source est supprimée : ses
   * téléphones reliés perdent leur lien. Refuse une source ou une destination inconnue, une source
   * égale à la destination, une source MJ (PR-12). Personne n'est notifié (NO-4).
   */
  mergeParticipant(sourceId: string, destinationId: string): void {
    const participants = this.allParticipants.getParticipantsAfterMergingParticipant(
      sourceId,
      destinationId,
    );
    const collaborators = this.buildSignUpMergeCollaborators();
    this.allSignUps = this.allSignUps.getSignUpsAfterMergingParticipant(
      sourceId,
      destinationId,
      this.allDraws,
      collaborators,
    );
    this.allDraws = this.allDraws.getDrawsAfterMergingParticipant(
      sourceId,
      destinationId,
      collaborators,
    );
    this.allParticipants = participants;
  }

  /**
   * Ce que `mergeParticipant()` fera, créneau par créneau, dans l'ordre de la journée, sans rien
   * changer : le même calcul que la fusion. Refuse comme elle.
   */
  computeMergeVerdict(sourceId: string, destinationId: string): MergeTimeSlotVerdict[] {
    this.allParticipants.verifyMergeAllowed(sourceId, destinationId);
    const collaborators = this.buildSignUpMergeCollaborators();
    const signUpMerge = this.allSignUps.computeSignUpMerge(
      sourceId,
      destinationId,
      this.allDraws,
      collaborators,
    );
    const assignmentMerges = this.allDraws.computeAssignmentMerges(
      sourceId,
      destinationId,
      collaborators,
    );
    const signUpGameIds = (timeSlotId: string, outcome: SignUpMergeOutcome) =>
      signUpMerge.signUps
        .filter((merge) => merge.timeSlotId === timeSlotId && merge.outcome === outcome)
        .map(({ gameId }) => gameId);
    return this.day.timeSlots.map(({ id: timeSlotId }) => {
      const assignment = assignmentMerges.find((merge) => merge.timeSlotId === timeSlotId);
      return {
        timeSlotId,
        assignment: assignment ? { gameId: assignment.gameId, outcome: assignment.outcome } : null,
        destinationLeavesDraw: assignmentMerges.some((merge) =>
          merge.destinationLeftTimeSlotIds.includes(timeSlotId),
        ),
        transferredSignUpGameIds: signUpGameIds(timeSlotId, 'transferred'),
        backupSignUpGameIds: signUpGameIds(timeSlotId, 'backup'),
        lostSignUpGameIds: signUpGameIds(timeSlotId, 'lost'),
        withoutGame:
          signUpMerge.withoutGame.find((merge) => merge.timeSlotId === timeSlotId)?.outcome ?? null,
      };
    });
  }

  /** Le MJ se déclare disponible sur un créneau existant (PR-2). Déclarer deux fois ne change rien. */
  declareGameMasterAvailability(gameMasterId: string, timeSlotId: string): void {
    this.allParticipants = this.allParticipants.getParticipantsAfterDeclaringAvailability(
      gameMasterId,
      timeSlotId,
      this.day,
    );
  }

  /**
   * Retire la disponibilité du MJ sur un créneau existant, sauf s'il y mène une partie (PR-15).
   * Retirer une absente ne change rien.
   */
  withdrawGameMasterAvailability(gameMasterId: string, timeSlotId: string): void {
    this.allParticipants = this.allParticipants.getParticipantsAfterWithdrawingAvailability(
      gameMasterId,
      timeSlotId,
      { day: this.day, schedule: this.gameSchedule },
    );
  }

  /**
   * Le verdict de retrait de chaque disponibilité du MJ, dans l'ordre de la journée : le refus que
   * `withdrawGameMasterAvailability()` y lèverait, ou `null`.
   */
  computeWithdrawalVerdicts(gameMasterId: string): WithdrawalVerdict[] {
    return this.allParticipants.computeWithdrawalVerdicts(gameMasterId, {
      day: this.day,
      schedule: this.gameSchedule,
    });
  }

  /**
   * Fabrique le scénario d'un MJ existant, qui lui reste fixé (PR-16). La convention n'en garde
   * rien : le scénario est un agrégat à part (ADR 0005).
   */
  proposeScenario(id: string, gameMasterId: string, details: ScenarioDetails): Scenario {
    this.allParticipants.verifyGameMasterExists(gameMasterId);
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
   * Programme le scénario sur un créneau et une table (PR-3), dans le respect de PR-5, hors d'un
   * créneau publié (TI-7). Une partie
   * double se programme sur son premier créneau, et prend le suivant, à la même table. Les
   * inscriptions de son MJ sur ses créneaux restent, inactives (IN-4). Rend « nouvelle partie »
   * et « tu mènes une partie » (`ScheduleChange`).
   */
  scheduleScenario(
    id: string,
    scenario: Scenario,
    timeSlotId: string,
    tableId: string,
  ): Notification[] {
    return this.replaceScheduleAndBuildNotifications(
      this.throwIfRefused(
        this.getScheduleAfterSchedulingScenario(id, scenario, timeSlotId, tableId),
      ),
    );
  }

  /**
   * Déplace la partie sur un créneau et une table (PR-17), dans le respect de PR-5, sans compter la
   * partie elle-même. Ni depuis ni vers un créneau publié, même à une autre table (TI-7). Une partie
   * double se déplace par son premier créneau, et prend le suivant.
   * Elle reste la même partie, à son rang dans le programme. Sur un autre créneau, elle perd ses
   * inscriptions ; à une autre table du même créneau, elle les garde (IN-6). Sur un autre créneau,
   * rend « partie déplacée » à ses inscrits, puis « nouvelle partie » et « tu mènes une partie »
   * (`ScheduleChange`).
   */
  moveGame(gameId: string, timeSlotId: string, tableId: string): Notification[] {
    const game = this.gameSchedule.findExistingGameById(gameId);
    return this.replaceScheduleAndBuildNotifications(
      this.throwIfRefused(this.getScheduleAfterMovingGame(game, timeSlotId, tableId)),
    );
  }

  /**
   * Échange deux parties (PR-17), dont aucune ne commence sur un créneau publié (TI-7) : chacune
   * prend le premier créneau et la table de l'autre, en un
   * seul geste. Les deux places sont vérifiées ensemble contre PR-5, sans compter les deux parties à
   * leur ancienne place. Chacune reste la même partie, à son rang dans le programme. Échangées entre
   * deux créneaux, elles perdent leurs inscriptions ; sur un même créneau, elles les gardent (IN-6).
   * Entre deux créneaux, rend pour chacune « partie déplacée » à ses inscrits (un inscrit aux deux
   * en reçoit une par partie), « nouvelle partie » et « tu mènes une partie » (`ScheduleChange`).
   */
  swapGames(gameId: string, otherGameId: string): Notification[] {
    const game = this.gameSchedule.findExistingGameById(gameId);
    const other = this.gameSchedule.findExistingGameById(otherGameId);
    return this.replaceScheduleAndBuildNotifications(
      this.throwIfRefused(this.getScheduleAfterSwappingGames(game, other)),
    );
  }

  /**
   * Déprogramme la partie (PR-17), sauf sur un créneau publié (TI-7) : son scénario reste proposé, et revient dans la réserve. Elle
   * perd ses inscriptions (IN-6). Rend « partie retirée du programme » à ses inscrits et à son MJ
   * (`ScheduleChange`).
   */
  unscheduleGame(gameId: string): Notification[] {
    return this.replaceScheduleAndBuildNotifications(
      this.throwIfRefused(this.getScheduleAfterUnschedulingGame(gameId)),
    );
  }

  /**
   * Le verdict de chaque case créneaux × tables pour le scénario : le refus que `scheduleScenario()` y
   * lèverait, ou `null`. Dans l'ordre des créneaux, puis des tables.
   */
  computePlacementVerdicts(scenario: Scenario): Placement[] {
    return this.day.timeSlots.flatMap((slot) =>
      this.tables.map((table) => {
        const result = this.getScheduleAfterSchedulingScenario(
          HYPOTHETICAL_GAME_ID,
          scenario,
          slot.id,
          table.id,
        );
        return {
          timeSlotId: slot.id,
          tableId: table.id,
          refusal: this.extractRefusal(result),
          erasedDrawTimeSlotId: this.computeErasedDrawTimeSlotId(result),
        };
      }),
    );
  }

  /**
   * Le verdict de la case pour chaque scénario du catalogue sans partie qui commence sur le créneau :
   * le refus que `scheduleScenario()` y lèverait, ou `null`. Dans l'ordre du catalogue. Une case
   * inconnue est refusée (`time-slot-not-found`, `table-not-found`).
   */
  computeCellPlacementVerdicts(
    catalogue: ScenarioCatalogue,
    timeSlotId: string,
    tableId: string,
  ): CellPlacement[] {
    this.day.verifyTimeSlotExists(timeSlotId);
    this.allTables.verifyItemExists(tableId);
    const starting = this.gameSchedule.listGamesStartingOnTimeSlot(timeSlotId);
    return catalogue
      .listEntries()
      .filter((entry) => !starting.some((game) => game.scenarioId === entry.id))
      .map((entry) => {
        const result = this.getScheduleAfterSchedulingScenario(
          HYPOTHETICAL_GAME_ID,
          entry,
          timeSlotId,
          tableId,
        );
        return {
          scenarioId: entry.id,
          refusal: this.extractRefusal(result),
          erasedDrawTimeSlotId: this.computeErasedDrawTimeSlotId(result),
        };
      });
  }

  /**
   * Le verdict de chaque case créneaux × tables pour déplacer la partie, dans l'ordre des créneaux,
   * puis des tables. La première case d'une autre partie propose de l'échanger avec elle
   * (`swapWith`), avec le refus que `swapGames()` lèverait ; toute autre case, le refus que
   * `moveGame()` y lèverait. Sa propre case est permise, sauf sur un créneau publié (TI-7). Une case permise dit aussi les inscriptions
   * que le geste retirerait (IN-6).
   */
  computeMoveVerdicts(gameId: string): MovePlacement[] {
    const game = this.gameSchedule.findExistingGameById(gameId);
    return this.day.timeSlots.flatMap((slot) =>
      this.tables.map((table) => {
        const other = this.gameSchedule.findOtherGameStartingAt(game, slot.id, table.id);
        const result = other
          ? this.getScheduleAfterSwappingGames(game, other)
          : this.getScheduleAfterMovingGame(game, slot.id, table.id);
        return {
          timeSlotId: slot.id,
          tableId: table.id,
          swapWith: other?.id ?? null,
          refusal: this.extractRefusal(result),
          erasedDrawTimeSlotId: this.computeErasedDrawTimeSlotId(result),
          removedSignUps: this.computeRemovedSignUps(result),
        };
      }),
    );
  }

  /**
   * Le verdict de `unscheduleGame()` : les inscriptions qu'il retirerait (IN-6), et le créneau dont
   * il effacerait le tirage provisoire (TI-6). Refuse, comme le geste, une partie d'un créneau publié
   * (TI-7).
   */
  computeUnscheduleVerdict(gameId: string): UnscheduleVerdict {
    const next = this.throwIfRefused(this.getScheduleAfterUnschedulingGame(gameId));
    return {
      removedSignUps: this.computeRemovedSignUps(next),
      erasedDrawTimeSlotId: this.computeErasedDrawTimeSlotId(next),
    };
  }

  /** La réserve (PR-6) : voir `computeReserve()`. */
  computeReserve(catalogue: ScenarioCatalogue): ReserveOfScenario[] {
    return computeReserve(catalogue, this.day, this.gameSchedule, this.allParticipants);
  }

  /**
   * Le suivi des inscriptions de chaque créneau, dans l'ordre de la journée : son état, sa demande et
   * sa capacité, que le catalogue, entier, donne, ses parties, ses participants (§4.4), sa réserve
   * (§4.4 étape 2) et son tirage. Voir `computeSignUpTracking()`.
   */
  computeSignUpTracking(catalogue: ScenarioCatalogue): TimeSlotTracking[] {
    return computeSignUpTracking(catalogue, {
      day: this.day,
      signUps: this.allSignUps,
      signUpCollaborators: this.buildSignUpCollaborators(this.gameSchedule),
      participants: this.allParticipants.participants,
      tables: this.tables,
      getDrawStage: (timeSlotId) => this.getDrawStage(timeSlotId),
      findDrawOfTimeSlot: (timeSlotId) => this.allDraws.findDrawOfTimeSlot(timeSlotId),
      findExistingParticipantIdOfGameMaster: (gameMasterId) =>
        this.findExistingParticipantIdOfGameMaster(gameMasterId),
      computeReserveOfTimeSlot: (timeSlotId) =>
        computeReserveOfTimeSlot(timeSlotId, catalogue, {
          day: this.day,
          schedule: this.gameSchedule,
          participants: this.allParticipants,
          tables: this.tables,
        }),
    });
  }

  /** Les inscriptions, dans l'ordre où elles ont été prises. */
  get signUps(): readonly SignUp[] {
    return this.allSignUps.signUps;
  }

  /** Les participants sans partie, enregistrés, même ignorés tant que leur MJ mène (IN-4). */
  get participantsWithoutGame(): readonly ParticipantWithoutGame[] {
    return this.allSignUps.participantsWithoutGame;
  }

  /**
   * Inscrit le participant à la partie (IN-2), tant que le tirage de son créneau n'est pas lancé.
   * Plusieurs inscriptions sur un même créneau sont permises. Une partie double compte sur ses deux
   * créneaux, et ne touche pas aux inscriptions prises sur son second créneau (IN-3, TI-3). Un MJ
   * ne s'inscrit pas à sa propre partie ; ailleurs sur un créneau où il mène, il s'inscrit en secours
   * (IN-4). Le catalogue, entier,
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
    const next = this.allSignUps.getSignUpsAfterSigningUp(
      signUp,
      this.buildSignUpCollaborators(this.gameSchedule),
    );
    if (this.allSignUps.hasSignUp(signUp)) return null;
    this.allSignUps = next;
    return this.buildOversubscribedNotifications(
      this.gameSchedule.findExistingGameById(gameId),
      next.listOversubscriptionRecipientsAfterSigningUp(
        signUp,
        catalogue,
        this.buildSignUpCollaborators(this.gameSchedule),
      ),
    );
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
      .filter((game) => this.getDrawStage(game.timeSlotIds[0]!) === 'sign-ups-open')
      .flatMap((game) =>
        this.buildOversubscribedNotifications(
          game,
          this.allSignUps.listOversubscriptionRecipientsAfterSeatsChange(
            game,
            scenario,
            previousSeats,
            this.buildSignUpCollaborators(this.gameSchedule),
          ),
        ),
      );
  }

  /**
   * Retire l'inscription du participant à la partie (IN-2), tant que le tirage de son créneau n'est
   * pas lancé. Rend `false` s'il n'y était pas inscrit : rien ne change.
   */
  withdrawFromGame(participantId: string, gameId: string): boolean {
    const signUp = this.buildSignUpIfOpen(participantId, gameId);
    if (!this.allSignUps.hasSignUp(signUp)) return false;
    this.allSignUps = this.allSignUps.getSignUpsAfterWithdrawing(signUp);
    return true;
  }

  /**
   * Le participant sans partie se retire du tirage du créneau, tant que ses inscriptions sont
   * ouvertes. Rend `false` s'il n'y était pas sans partie : rien ne change (comme IN-2).
   */
  withdrawFromDraw(participantId: string, timeSlotId: string): boolean {
    const participant = this.allParticipants.findExistingParticipantById(participantId);
    this.day.verifyTimeSlotExists(timeSlotId);
    this.verifySignUpsOpen(timeSlotId);
    const withdrawn = new ParticipantWithoutGame(participant.id, timeSlotId);
    if (!this.allSignUps.hasParticipantWithoutGame(withdrawn)) return false;
    this.allSignUps = this.allSignUps.getSignUpsAfterWithdrawingFromDraw(withdrawn);
    return true;
  }

  /** Les tirages lancés, un par créneau. */
  get draws(): readonly Draw[] {
    return this.allDraws.draws;
  }

  /**
   * Lance le tirage du créneau (TI-1) : ferme ses inscriptions, puis enregistre l'affectation que
   * l'algorithme rend à chacun de ses participants, avec cette source de hasard. Seul le premier
   * créneau dont le tirage n'est pas publié se lance. Le catalogue, entier, donne les places des
   * parties. Une sortie fautive de l'algorithme lève `FaultyDrawOutputError` : rien ne change.
   * Aucune notification (NO-4).
   */
  launchDraw(
    timeSlotId: string,
    catalogue: ScenarioCatalogue,
    algorithm: DrawAlgorithm,
    random: RandomSource,
  ): void {
    this.day.verifyTimeSlotExists(timeSlotId);
    this.allDraws = this.allDraws.getDrawsAfterLaunchingDraw(
      timeSlotId,
      algorithm,
      random,
      this.buildDrawCollaborators(catalogue),
    );
  }

  /**
   * Relance le tirage provisoire du créneau (TI-6) : un nouveau tirage, que l'algorithme rend avec
   * cette source de hasard, à partir des inscriptions actives et des places actuelles. Les
   * déplacements à la main sont effacés. Une sortie fautive lève `FaultyDrawOutputError` : rien ne
   * change. Aucune notification.
   */
  rerunDraw(
    timeSlotId: string,
    catalogue: ScenarioCatalogue,
    algorithm: DrawAlgorithm,
    random: RandomSource,
  ): void {
    this.day.verifyTimeSlotExists(timeSlotId);
    this.allDraws = this.allDraws.getDrawsAfterRerunningDraw(
      timeSlotId,
      algorithm,
      random,
      this.buildDrawCollaborators(catalogue),
    );
  }

  /**
   * Rouvre les inscriptions du créneau (TI-6) : son tirage provisoire est effacé. Les participants
   * sans partie restent. Aucune notification.
   */
  reopenSignUps(timeSlotId: string): void {
    this.day.verifyTimeSlotExists(timeSlotId);
    this.allDraws = this.allDraws.getDrawsAfterReopeningSignUps(timeSlotId, this.day);
  }

  /**
   * Annule la partie dans le tirage provisoire de son premier créneau (TI-6) : ses joueurs passent
   * non placés, et son MJ entre au tirage, non placé, comme participant. Il n'y mène plus : ses
   * inscriptions sur ses créneaux redeviennent actives (IN-4). Le catalogue, entier, donne le
   * minimum de la partie. Aucune notification : elles partent à la publication.
   */
  cancelGame(gameId: string, catalogue: ScenarioCatalogue): void {
    const game = this.gameSchedule.findExistingGameById(gameId);
    this.allDraws = this.allDraws.getDrawsAfterCancellingGame(game, {
      day: this.day,
      catalogue,
      gameMasterParticipantId: this.findExistingParticipantIdOfGameMaster(game.gameMasterId),
    });
  }

  /**
   * Rétablit la partie annulée (TI-6) : elle revient sans joueur, et son MJ sort du tirage, où
   * qu'il soit placé, pour la mener de nouveau. Aucune notification.
   */
  restoreGame(gameId: string): void {
    const game = this.gameSchedule.findExistingGameById(gameId);
    this.allDraws = this.allDraws.getDrawsAfterRestoringGame(game, {
      day: this.day,
      gameMasterParticipantId: this.findExistingParticipantIdOfGameMaster(game.gameMasterId),
    });
  }

  /**
   * Déplace le participant dans le tirage provisoire du créneau (TI-6) : vers une partie qui y
   * commence, même sans inscription ou au-delà de son maximum, ou vers les non placés pour `null`.
   * Il est marqué « déplacé à la main ». Aucune notification.
   */
  moveParticipant(timeSlotId: string, participantId: string, gameId: string | null): void {
    const participant = this.allParticipants.findExistingParticipantById(participantId);
    const game = gameId === null ? null : this.gameSchedule.findExistingGameById(gameId);
    this.allDraws = this.allDraws.getDrawsAfterMovingParticipant(
      timeSlotId,
      participant,
      game,
      this.day,
    );
  }

  /**
   * Publie le tirage provisoire du créneau (TI-7) : son résultat est figé. Refuse un tirage dont une
   * partie non annulée n'a aucun joueur. Déprogramme ensuite chaque partie annulée : son scénario
   * retourne dans la réserve, sa table et son MJ sont libérés, sur tous ses créneaux. Le tirage reste,
   * personne ne devient sans partie, et IN-6 ne notifie personne. Rend « partie annulée » à leur MJ,
   * « table » à chaque joueur, « pas de place » aux autres non placés, avec les tables où il reste de
   * la place, et « tu mènes » à chaque MJ. Le catalogue, entier, donne les places maximum des parties.
   */
  publishDraw(timeSlotId: string, catalogue: ScenarioCatalogue): Notification[] {
    this.day.verifyTimeSlotExists(timeSlotId);
    const nextDraws = this.allDraws.getDrawsAfterPublishingDraw(
      timeSlotId,
      this.day,
      this.gameSchedule,
    );
    const provisional = this.allDraws.findDrawOfTimeSlot(timeSlotId)!;
    const notifications = buildDrawPublicationNotifications(provisional, {
      day: this.day,
      date: this.state.date,
      schedule: this.gameSchedule,
      tables: this.allTables,
      participants: this.allParticipants,
      catalogue,
      signUps: this.allSignUps,
      signUpCollaborators: this.buildSignUpCollaborators(this.gameSchedule),
    });
    const cancelled = provisional.cancelledGameIds;
    this.allDraws = nextDraws;
    this.gameSchedule = this.gameSchedule.getScheduleAfterUnschedulingGames(cancelled);
    this.allSignUps = this.allSignUps.getSignUpsAfterUnschedulingGames(cancelled);
    return notifications;
  }

  /**
   * Ajoute le retardataire au tirage publié du créneau, non placé (ID-14) : il va voir les MJ des
   * tables où il reste de la place. Les places restantes ne changent pas. Refuse un créneau sans
   * tirage publié ou terminé à cet instant, un participant déjà dans ce tirage, un MJ qui y mène
   * (IN-4), un joueur d'une partie double tirée au créneau précédent (TI-3). Rend « retardataire »
   * au participant (NO-2), avec ces tables ; le catalogue, entier, donne les places maximum.
   */
  addLatecomerToPublishedDraw(
    participantId: string,
    timeSlotId: string,
    now: LocalMoment,
    catalogue: ScenarioCatalogue,
  ): Notification[] {
    const participant = this.allParticipants.findExistingParticipantById(participantId);
    this.day.verifyTimeSlotExists(timeSlotId);
    const collaborators = {
      ...this.buildLatecomerCollaborators(),
      tables: this.allTables,
      catalogue,
    };
    this.allDraws = this.allDraws.getDrawsAfterAddingLatecomer(
      participant,
      timeSlotId,
      now,
      collaborators,
    );
    return [
      buildLatecomerNotification(
        this.allDraws.findDrawOfTimeSlot(timeSlotId)!,
        participant.id,
        collaborators,
      ),
    ];
  }

  /**
   * On peut ajouter le participant au tirage publié du créneau, non placé : `addLatecomerToPublishedDraw()`
   * ne le refuserait pas à cet instant. Pour la fiche du pseudo (ID-14), qui ne propose le geste que
   * là.
   */
  isLatecomerAdditionAllowed(participantId: string, timeSlotId: string, now: LocalMoment): boolean {
    const participant = this.allParticipants.findExistingParticipantById(participantId);
    this.day.verifyTimeSlotExists(timeSlotId);
    return !this.allDraws.findLatecomerRefusal(
      participant,
      timeSlotId,
      now,
      this.buildLatecomerCollaborators(),
    );
  }

  /** Ce que l'ajout d'un retardataire lit hors des Tirages (ID-14). */
  private buildLatecomerCollaborators(): LatecomerCollaborators {
    return {
      day: this.day,
      date: this.state.date,
      schedule: this.gameSchedule,
      ledGames: this.buildLedGames(this.gameSchedule),
    };
  }

  /**
   * Retire un participant supprimé de ses inscriptions, de son état sans partie et de ses
   * affectations de tous les tirages : commun à la suppression d'un MJ et à celle d'un pseudo.
   */
  private removeParticipantFromSignUpsAndDraws(participantId: string): void {
    this.allSignUps = this.allSignUps.getSignUpsAfterRemovingParticipant(participantId);
    this.allDraws = this.allDraws.getDrawsAfterRemovingParticipant(participantId);
  }

  /** Ce que le tirage lit hors des Tirages, avec ce catalogue, entier. */
  private buildDrawCollaborators(catalogue: ScenarioCatalogue): DrawCollaborators {
    return {
      day: this.day,
      signUps: this.allSignUps,
      signUpCollaborators: this.buildSignUpCollaborators(this.gameSchedule),
      catalogue,
      findExistingParticipantIdOfGameMaster: (gameMasterId) =>
        this.findExistingParticipantIdOfGameMaster(gameMasterId),
    };
  }

  private findExistingParticipantIdOfGameMaster(gameMasterId: string): string {
    return this.allParticipants.findExistingGameMasterById(gameMasterId).participant.id;
  }

  /**
   * La situation du participant : ses inscriptions actives, ses inscriptions de secours (IN-4), puis
   * l'état de chaque créneau à cet instant, dans l'ordre de la journée, avec la partie qu'y mène son
   * MJ, le résultat de son tirage, et s'il y est sans partie.
   */
  computeParticipantSituation(participantId: string, now: LocalMoment): ParticipantSituation {
    const participant = this.allParticipants.findExistingParticipantById(participantId);
    const collaborators = this.buildSignUpCollaborators(this.gameSchedule);
    // Le MJ ne voit rien de l'annulation de sa partie avant la publication (§5.7) : sur ses
    // créneaux, ses inscriptions restent de secours tant que sa partie est au programme, annulée
    // ou non.
    const backupGameIds = this.allSignUps.listBackupGameIdsOfParticipant(participant.id, {
      schedule: this.gameSchedule,
      ledGames: this.buildLedGamesCancelledIncluded(),
    });
    return {
      signedUpGameIds: this.allSignUps
        .listActiveGameIdsOfParticipant(participant.id, collaborators)
        .filter((gameId) => !backupGameIds.includes(gameId)),
      backupGameIds,
      timeSlots: this.day.timeSlots.map((slot) => ({
        timeSlotId: slot.id,
        state: this.computeTimeSlotStateAt(slot.id, now),
        ledGameId: this.findGameLedByParticipantOnTimeSlot(participant.id, slot.id)?.id ?? null,
        drawResult: this.computeDrawResult(participant.id, slot.id),
        withoutGame: this.allSignUps.isParticipantWithoutGameOnTimeSlot(
          participant.id,
          slot.id,
          collaborators,
        ),
      })),
    };
  }

  /**
   * Le résultat du participant sur chaque créneau, dans l'ordre de la journée, avec l'état du
   * créneau à cet instant, pour la fiche du pseudo (ID-5). Le tirage provisoire se lit comme le
   * tirage publié. Le catalogue, entier, donne les places maximum des parties.
   */
  computeParticipantResults(
    participantId: string,
    now: LocalMoment,
    catalogue: ScenarioCatalogue,
  ): ParticipantTimeSlotResult[] {
    const participant = this.allParticipants.findExistingParticipantById(participantId);
    return this.day.timeSlots.map((slot) => ({
      timeSlotId: slot.id,
      state: this.computeTimeSlotStateAt(slot.id, now),
      result: this.computeParticipantResultOnTimeSlot(participant.id, slot.id, catalogue),
    }));
  }

  /**
   * Son affectation dans le tirage du créneau, ou dans une partie double qui s'y poursuit (TI-3) ;
   * sinon la partie qu'il y mène, non annulée ; sinon, sur un créneau tiré, « pas dans le tirage » ;
   * sinon le nombre de ses inscriptions aux parties qui y commencent, de secours comprises.
   */
  private computeParticipantResultOnTimeSlot(
    participantId: string,
    timeSlotId: string,
    catalogue: ScenarioCatalogue,
  ): ParticipantResult {
    const draw = this.allDraws.findDrawOfTimeSlot(timeSlotId);
    const assignment =
      draw?.findAssignmentOfParticipant(participantId) ??
      this.allDraws.findAssignmentContinuingOnTimeSlot(
        participantId,
        timeSlotId,
        this.gameSchedule,
      );
    if (assignment?.gameId) {
      const game = this.gameSchedule.findExistingGameById(assignment.gameId);
      return {
        kind: 'assigned',
        gameId: game.id,
        tableName: this.findExistingTableName(game.tableId),
        gameMasterNickname: this.allParticipants.findExistingGameMasterById(game.gameMasterId)
          .participant.nickname.text,
      };
    }
    if (assignment) {
      return {
        kind: 'unassigned',
        tablesWithSeats: draw!
          .listTablesWithSeats({
            schedule: this.gameSchedule,
            tables: this.allTables.itemsInNaturalOrder,
            catalogue,
          })
          .map(({ tableId, freeSeatCount }) => ({
            tableName: this.findExistingTableName(tableId),
            freeSeatCount,
          })),
      };
    }
    const led = this.findGameLedByParticipantOnTimeSlot(participantId, timeSlotId);
    if (led && !this.allDraws.isGameCancelled(led.id)) {
      return {
        kind: 'leading',
        gameId: led.id,
        tableName: this.findExistingTableName(led.tableId),
      };
    }
    if (draw) return { kind: 'not-in-draw' };
    return {
      kind: 'signed-up',
      signUpCount: this.allSignUps.countSignUpsOfParticipantOnTimeSlot(
        participantId,
        timeSlotId,
        this.gameSchedule,
      ),
    };
  }

  private findExistingTableName(tableId: string): string {
    return this.allTables.findExistingItemById(tableId).name.text;
  }

  /**
   * Le résultat publié du tirage du créneau pour le participant (§5.7) : sa partie, ou pas de
   * place, s'il est du tirage ; sinon, pour un MJ, les joueurs de la partie qu'il mène et qui
   * commence sur le créneau. `null` avant la publication.
   */
  private computeDrawResult(participantId: string, timeSlotId: string): DrawResult {
    const draw = this.allDraws.findPublishedDrawOfTimeSlot(timeSlotId);
    if (!draw) return null;
    const assignment = draw.findAssignmentOfParticipant(participantId);
    if (assignment) {
      return assignment.gameId
        ? { kind: 'assigned', gameId: assignment.gameId }
        : { kind: 'unassigned' };
    }
    const led = this.findGameLedByParticipantOnTimeSlot(participantId, timeSlotId);
    if (!led || led.timeSlotIds[0] !== timeSlotId) return null;
    const players = new Set(draw.listPlayerIdsOfGame(led.id));
    return {
      kind: 'leading',
      players: this.allParticipants.participants
        .filter(({ id }) => players.has(id))
        .map(({ nickname }) => nickname.text),
    };
  }

  /** La partie que mène le MJ du participant sur ce créneau, ou `undefined` (ADR 0012). */
  private findGameLedByParticipantOnTimeSlot(
    participantId: string,
    timeSlotId: string,
  ): Game | undefined {
    const gameMaster = this.allParticipants.findGameMasterOfParticipant(participantId);
    return (
      gameMaster && this.gameSchedule.findGameLedByGameMasterOnTimeSlot(gameMaster.id, timeSlotId)
    );
  }

  /**
   * « Partie très demandée » à ces destinataires, que les inscriptions désignent (IN-5). Elle court
   * jusqu'à la fin du dernier créneau de la partie (NO-3). Rien sans destinataire.
   */
  private buildOversubscribedNotifications(game: Game, recipients: string[]): Notification[] {
    if (!recipients.length) return [];
    return [
      {
        code: 'game-oversubscribed',
        params: { scenarioId: game.scenarioId, rank: this.getTimeSlotRank(game.timeSlotIds[0]!) },
        recipients: buildParticipantRecipients(recipients),
        deadline: this.day.computeEndOfTimeSlots(this.state.date, game.timeSlotIds),
      },
    ];
  }

  /** Les parties que mène chaque participant au Programme, annulées par un tirage comprises. */
  private buildLedGamesCancelledIncluded(): LedGames {
    return LedGames.createFromLister((participantId) => {
      const gameMaster = this.allParticipants.findGameMasterOfParticipant(participantId);
      return gameMaster ? this.gameSchedule.listGamesLedByGameMaster(gameMaster.id) : [];
    });
  }

  /**
   * Les parties que mène chaque participant par son MJ (ADR 0012), tirées de ce Programme, sans
   * celles qu'un tirage annule (TI-6).
   */
  private buildLedGames(schedule: Schedule): LedGames {
    return LedGames.createFromLister((participantId) => {
      const gameMaster = this.allParticipants.findGameMasterOfParticipant(participantId);
      if (!gameMaster) return [];
      return schedule
        .listGamesLedByGameMaster(gameMaster.id)
        .filter((game) => !this.allDraws.isGameCancelled(game.id));
    });
  }

  /**
   * Ce que lisent les règles des inscriptions : ce Programme, les parties que mène chaque
   * participant (`buildLedGames()`), et les créneaux qu'il occupe comme joueur d'une partie double
   * publiée, tirés des Tirages (TI-3).
   */
  private buildSignUpCollaborators(schedule: Schedule): SignUpCollaborators {
    const ledGames = this.buildLedGames(schedule);
    const playedTimeSlots: PlayedTimeSlots = {
      listTimeSlotIdsPlayedByParticipant: (participantId) =>
        this.allDraws.listTimeSlotIdsPlayedByParticipant(participantId, schedule),
    };
    return { schedule, ledGames, playedTimeSlots };
  }
  /**
   * Ce que lit la fusion d'un pseudo (ID-11) : les collaborateurs des inscriptions, et les parties
   * menées, annulées comprises.
   */
  private buildSignUpMergeCollaborators(): SignUpMergeCollaborators {
    return {
      ...this.buildSignUpCollaborators(this.gameSchedule),
      ledGamesCancelledIncluded: this.buildLedGamesCancelledIncluded(),
    };
  }

  /** L'avancement du tirage du créneau, que donnent les Tirages. */
  private getDrawStage(timeSlotId: string): DrawStage {
    return this.allDraws.getDrawStage(timeSlotId);
  }

  /**
   * L'inscription du participant à la partie, qui doivent exister, ou le refus du geste : le tirage
   * de son créneau est lancé. Une partie double est tirée avec son premier créneau (TI-3).
   */
  private buildSignUpIfOpen(participantId: string, gameId: string): SignUp {
    const participant = this.allParticipants.findExistingParticipantById(participantId);
    const game = this.gameSchedule.findExistingGameById(gameId);
    this.verifySignUpsOpen(game.timeSlotIds[0]!);
    return new SignUp(participant.id, game.id);
  }

  /** Refuse un geste du participant sur le créneau une fois son tirage lancé (IN-2). */
  private verifySignUpsOpen(timeSlotId: string): void {
    if (this.getDrawStage(timeSlotId) !== 'sign-ups-open') {
      throw new Refusal('sign-ups-closed', { rank: this.getTimeSlotRank(timeSlotId) });
    }
  }

  /**
   * Le Programme après la programmation du scénario sur cette case, ou le refus d'un créneau publié
   * (TI-7), puis de PR-5.
   */
  private getScheduleAfterSchedulingScenario(
    id: string,
    scenario: SchedulableScenario,
    timeSlotId: string,
    tableId: string,
  ): Schedule | Refusal {
    this.day.verifyTimeSlotExists(timeSlotId);
    return (
      this.allDraws.findPublishedTimeSlotRefusal([timeSlotId], this.day) ??
      this.gameSchedule.getScheduleAfterSchedulingScenario(
        id,
        scenario,
        timeSlotId,
        this.findExistingGameMasterAndTable(scenario.gameMasterId, tableId),
        this.day,
      )
    );
  }

  /**
   * Le Programme après le déplacement de la partie sur cette case, ou le refus : son premier créneau,
   * puis celui de la case, est publié (TI-7) ; puis PR-5. Un changement de table compte.
   */
  private getScheduleAfterMovingGame(
    game: Game,
    timeSlotId: string,
    tableId: string,
  ): Schedule | Refusal {
    this.day.verifyTimeSlotExists(timeSlotId);
    return (
      this.allDraws.findPublishedTimeSlotRefusal([game.timeSlotIds[0]!, timeSlotId], this.day) ??
      this.gameSchedule.getScheduleAfterMovingGame(
        game,
        timeSlotId,
        this.findExistingGameMasterAndTable(game.gameMasterId, tableId),
        this.day,
      )
    );
  }

  /**
   * Le Programme après l'échange des deux parties, ou le refus : le premier créneau de l'une est
   * publié (TI-7) ; puis PR-5.
   */
  private getScheduleAfterSwappingGames(game: Game, other: Game): Schedule | Refusal {
    return (
      this.allDraws.findPublishedTimeSlotRefusal(
        [game.timeSlotIds[0]!, other.timeSlotIds[0]!],
        this.day,
      ) ??
      this.gameSchedule.getScheduleAfterSwappingGames(
        game,
        this.findExistingGameMasterAndTable(game.gameMasterId, other.tableId),
        other,
        this.findExistingGameMasterAndTable(other.gameMasterId, game.tableId),
        this.day,
      )
    );
  }

  /** Le Programme après le retrait de la partie, ou le refus d'un créneau publié (TI-7). */
  private getScheduleAfterUnschedulingGame(gameId: string): Schedule | Refusal {
    const game = this.gameSchedule.findExistingGameById(gameId);
    return (
      this.allDraws.findPublishedTimeSlotRefusal([game.timeSlotIds[0]!], this.day) ??
      this.gameSchedule.getScheduleAfterUnschedulingGame(gameId)
    );
  }

  /** Le MJ et la table d'une partie, qui doivent exister. */
  private findExistingGameMasterAndTable(
    gameMasterId: string,
    tableId: string,
  ): PlacementCollaborators {
    const table = this.allTables.findExistingItemById(tableId);
    return { gameMaster: this.allParticipants.findExistingGameMasterById(gameMasterId), table };
  }

  /**
   * Remplace le Programme, et rend les notifications du changement (`ScheduleChange`). Le tirage
   * provisoire d'un créneau dont les parties changent est d'abord effacé, annulations comprises
   * (TI-6) ; IN-6 s'applique ensuite : une partie déprogrammée, ou qui passe sur d'autres créneaux,
   * perd ses inscriptions ; changer de table les garde. Les notifications lisent les inscriptions
   * d'avant, que le remplacement efface, celles d'après, qui disent qui devient sans partie, et
   * l'état des créneaux d'avant, qui dit lesquels rouvrent.
   */
  private replaceScheduleAndBuildNotifications(next: Schedule): Notification[] {
    const change = new ScheduleChange(this.gameSchedule, next);
    const previousDraws = this.allDraws;
    this.allDraws = previousDraws.getDrawsAfterChangingSchedule(change);
    const previousSignUpCollaborators = this.buildSignUpCollaborators(this.gameSchedule);
    const nextSignUpCollaborators = this.buildSignUpCollaborators(next);
    const nextSignUps = this.allSignUps.getSignUpsAfterChangingSchedule(
      previousSignUpCollaborators,
      nextSignUpCollaborators,
    );
    const notifications = change.buildNotifications({
      day: this.day,
      date: this.state.date,
      tables: this.allTables,
      participants: this.allParticipants,
      previousSignUps: this.allSignUps,
      previousSignUpCollaborators,
      nextSignUps,
      nextSignUpCollaborators,
      getDrawStage: (timeSlotId) => previousDraws.getDrawStage(timeSlotId),
    });
    this.allSignUps = nextSignUps;
    this.gameSchedule = next;
    return notifications;
  }

  /** Le Programme accepté, ou lève son refus. */
  private throwIfRefused(result: Schedule | Refusal): Schedule {
    if (result instanceof Refusal) throw result;
    return result;
  }

  /** Les inscriptions que le passage au Programme d'après retirerait ; aucune pour un geste refusé. */
  private computeRemovedSignUps(next: Schedule | Refusal): RemovedSignUps[] {
    if (next instanceof Refusal) return [];
    return this.allSignUps.computeRemovedSignUpsAfterChangingSchedule(
      next,
      this.buildSignUpCollaborators(this.gameSchedule),
    );
  }

  /**
   * Le créneau dont le passage au Programme d'après effacerait le tirage provisoire (TI-6), ou
   * `null` ; aucun pour un geste refusé.
   */
  private computeErasedDrawTimeSlotId(next: Schedule | Refusal): string | null {
    if (next instanceof Refusal) return null;
    return this.allDraws.findProvisionalTimeSlotIdErasedBy(
      new ScheduleChange(this.gameSchedule, next),
    );
  }

  /** Le refus d'un geste, ou `null` s'il est permis : le verdict. */
  private extractRefusal(result: Schedule | Refusal): Refusal | null {
    return result instanceof Refusal ? result : null;
  }

  /** Refuse une journée qui couperait une partie double (PR-11), et la renvoie sinon. */
  private verifyTwoSlotGamesStayConsecutive(nextDay: Day): Day {
    this.gameSchedule.verifyTwoSlotGamesStayConsecutive(this.day, nextDay);
    return nextDay;
  }
}

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
 * L'avancement du tirage d'un créneau : inscriptions ouvertes, tirage lancé (inscriptions fermées,
 * résultat provisoire), ou tirage publié (résultat figé). Il ne change que par un geste, et les
 * règles des gestes s'en tiennent à lui.
 */
export type DrawStage = 'sign-ups-open' | 'drawing' | 'published';

/**
 * L'état d'un créneau à un instant : l'avancement de son tirage, ou « terminé », une fois son
 * tirage publié et son heure de fin passée. Les lectures le servent aux fronts.
 */
export type TimeSlotState = DrawStage | 'ended';

/**
 * Le résultat publié du tirage d'un créneau pour un participant : sa partie (`assigned`), ou pas de
 * place (`unassigned`). Pour un MJ, sur le créneau où commence sa partie : ses joueurs, dans l'ordre
 * naturel de leur pseudo (`leading`). Le MJ d'une partie annulée, que la publication déprogramme, a
 * son sort de joueur. `null` tant que le tirage n'est pas publié, ou sans inscription.
 */
export type DrawResult =
  | { kind: 'assigned'; gameId: string }
  | { kind: 'unassigned' }
  | { kind: 'leading'; players: string[] }
  | null;

/** La situation d'un participant : voir `Convention.computeParticipantSituation()`. */
export type ParticipantSituation = {
  signedUpGameIds: string[];
  /**
   * Ses inscriptions de secours : sur un créneau où son MJ mène, elles ne comptent que si sa partie
   * quitte le créneau (IN-4). Dans l'ordre où elles ont été prises.
   */
  backupGameIds: string[];
  timeSlots: {
    timeSlotId: string;
    state: TimeSlotState;
    /** La partie que mène son MJ sur ce créneau, les deux d'une partie double, ou `null` (IN-4). */
    ledGameId: string | null;
    drawResult: DrawResult;
    /** Il y est sans partie : il reste dans son tirage, sans inscription active (IN-6). */
    withoutGame: boolean;
  }[];
};

/**
 * Le résultat d'un participant sur un créneau, pour la fiche de son pseudo (ID-5) : placé dans le
 * tirage, provisoire ou publié, ou dans une partie double qui s'y poursuit (`assigned`) ; non placé,
 * avec les tables où il reste de la place (`unassigned`) ; MJ de la partie qu'il y mène
 * (`leading`) ; absent d'un tirage lancé (`not-in-draw`) ; ou, inscriptions ouvertes, le nombre de
 * ses inscriptions aux parties qui y commencent, de secours comprises (`signed-up`).
 */
export type ParticipantResult =
  | { kind: 'assigned'; gameId: string; tableName: string; gameMasterNickname: string }
  | { kind: 'unassigned'; tablesWithSeats: { tableName: string; freeSeatCount: number }[] }
  | { kind: 'leading'; gameId: string; tableName: string }
  | { kind: 'not-in-draw' }
  | { kind: 'signed-up'; signUpCount: number };

/** Le résultat d'un participant sur un créneau, avec l'état du créneau à cet instant. */
export type ParticipantTimeSlotResult = {
  timeSlotId: string;
  state: TimeSlotState;
  result: ParticipantResult;
};

/**
 * Ce que dit en plus le verdict d'un geste de programmation : le créneau dont il effacerait le
 * tirage provisoire (TI-6), ou `null`, toujours pour un geste refusé.
 */
export type DrawErasure = { erasedDrawTimeSlotId: string | null };

/** Le verdict d'une case créneau × table pour un scénario : le refus d'écriture, ou `null`. */
export type Placement = DrawErasure & {
  timeSlotId: string;
  tableId: string;
  refusal: Refusal | null;
};

/** Le verdict d'une case pour un scénario : le refus d'écriture, ou `null`. */
export type CellPlacement = DrawErasure & { scenarioId: string; refusal: Refusal | null };

/**
 * Le verdict d'une case créneau × table pour déplacer une partie : `swapWith`, l'id de la partie
 * avec laquelle l'échanger, ou `null` pour un déplacement ; le refus d'écriture, ou `null` ; les
 * inscriptions que le geste retirerait, aucune s'il est refusé.
 */
export type MovePlacement = Placement & {
  swapWith: string | null;
  removedSignUps: RemovedSignUps[];
};

/**
 * Le verdict de la déprogrammation d'une partie : les inscriptions qu'elle retirerait, et le
 * tirage provisoire qu'elle effacerait.
 */
export type UnscheduleVerdict = DrawErasure & { removedSignUps: RemovedSignUps[] };

/**
 * Ce que la fusion d'un pseudo fera sur un créneau (ID-11). `assignment` : l'affectation de la
 * source dans son tirage, sa partie ou `null` non placée, passée à la destination ou perdue ; `null`
 * si la source n'y est pas. `destinationLeavesDraw` : la destination quitte ce tirage, en prenant la
 * partie double de la source (TI-3). Les inscriptions de la source aux parties qui commencent sur le
 * créneau, passées, passées en secours là où la destination mène une autre partie (IN-4), ou
 * perdues, sans celles que la destination a déjà. `withoutGame` : le sort de l'état sans partie de
 * la source, ou `null` sans cet état (IN-6).
 */
export type MergeTimeSlotVerdict = {
  timeSlotId: string;
  assignment: { gameId: string | null; outcome: MergeOutcome } | null;
  destinationLeavesDraw: boolean;
  transferredSignUpGameIds: string[];
  backupSignUpGameIds: string[];
  lostSignUpGameIds: string[];
  withoutGame: MergeOutcome | null;
};

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
