import { ComparableName } from '../comparable-name.js';
import type { Notification } from '../notification.js';
import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Scenario, type ScenarioDetails } from '../scenario/scenario.js';
import { Day } from './day.js';
import type { Game } from './game.js';
import { GameMaster } from './game-master.js';
import type { LocalMoment } from './local-moment.js';
import { Participant } from './participant.js';
import type { PresenceCode } from './presence-code.js';
import { Table } from './table.js';
import { reserveOfEachScenario, type ReserveOfScenario } from './reserve.js';
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
  static endOf(date: string | null, timeSlotEnds: readonly TimeOfDay[]): LocalMoment | null {
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
  static isSignUpSuspended(
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
      Day.ordering(timeSlots),
      UniquelyNamedCollection.holding(tables, TABLE_NAMING_RULES),
      UniquelyNamedCollection.holding(gameMasters, NICKNAME_RULES),
      UniquelyNamedCollection.holding(
        new Map(
          [...participants, ...gameMasters.map((gameMaster) => gameMaster.participant)].map(
            (participant) => [participant.id, participant],
          ),
        ).values(),
        PARTICIPANT_NICKNAME_RULES,
      ),
      Schedule.holding(games),
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

  /** La fin de la convention, ou `null` sans date ou sans créneau : voir `Convention.endOf()`. */
  get end(): LocalMoment | null {
    return Convention.endOf(
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
  verifyOpenAt(now: LocalMoment): void {
    if (this.hasEndedAt(now)) throw new Refusal('convention-ended', {});
  }

  /** Refuse un code qui n'est pas le code de présence (ID-2), et toute entrée une fois terminée. */
  verifyPresenceCode(presented: string, now: LocalMoment): void {
    this.verifyOpenAt(now);
    if (!this.state.presenceCode.matches(presented)) {
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
  identify(
    newParticipantId: string,
    presentedCode: string,
    nickname: string,
    confirmation: IdentityConfirmation | null,
    now: LocalMoment,
  ): Identification {
    this.verifyPresenceCode(presentedCode, now);
    const typed = ComparableName.of(nickname);
    const existing = this.allParticipants.itemNamed(typed);
    if (!existing) {
      const participant = new Participant(newParticipantId, typed);
      this.allParticipants = this.allParticipants.afterAdding(participant);
      return { verdict: 'link', created: true, participant };
    }
    const expected = this.isGameMaster(existing) ? 'game-master' : 'participant';
    if (confirmation !== expected) {
      return { verdict: 'confirm', confirmation: expected, nickname: existing.nickname.text };
    }
    return { verdict: 'link', created: false, participant: existing };
  }

  /** Les participants, MJ compris, dans l'ordre naturel de leur pseudo. */
  get participants(): readonly Participant[] {
    return this.allParticipants.inNaturalOrder;
  }

  /** Le participant a un rôle de MJ (ADR 0012). */
  private isGameMaster(participant: Participant): boolean {
    return this.gameMasterOfParticipant(participant.id) !== undefined;
  }

  /** Le MJ du participant, ou `undefined` s'il n'en a pas le rôle (ADR 0012). */
  private gameMasterOfParticipant(participantId: string): GameMaster | undefined {
    return this.allGameMasters.inNaturalOrder.find(
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
  setDate(date: string | null): void {
    this.state.date = date;
  }

  /** Les créneaux, dans l'ordre de la journée. */
  get timeSlots(): readonly TimeSlot[] {
    return this.day.timeSlots;
  }

  /** Rang du créneau dans la journée, à partir de 1 (PR-8). */
  rankOfTimeSlot(timeSlotId: string): number {
    return this.day.rankOfTimeSlot(timeSlotId);
  }

  addTimeSlot(id: string, start: TimeOfDay, end: TimeOfDay): void {
    this.day = this.verifyTwoSlotGamesStayConsecutive(this.day.afterAdding(id, start, end));
  }

  /** Les heures d'un créneau qui porte une partie ou une disponibilité ne se modifient plus (PR-11). */
  changeTimeSlotHours(id: string, start: TimeOfDay, end: TimeOfDay): void {
    const current = this.day.existingTimeSlot(id);
    if (current.start.equals(start) && current.end.equals(end)) return;
    const games = this.gameSchedule.gameCountOnTimeSlot(id);
    if (games > 0) {
      throw new Refusal('time-slot-hours-locked-by-games', {
        rank: this.rankOfTimeSlot(id),
        games,
      });
    }
    const availabilities = this.availabilityCountOnTimeSlot(id);
    if (availabilities > 0) {
      throw new Refusal('time-slot-hours-locked', {
        rank: this.rankOfTimeSlot(id),
        availabilities,
      });
    }
    this.day = this.verifyTwoSlotGamesStayConsecutive(this.day.afterChangingHours(id, start, end));
  }

  /**
   * Supprime un créneau, et les disponibilités qui s'y rattachent. Un créneau qui porte des parties
   * reste (PR-10).
   */
  removeTimeSlot(id: string): void {
    this.day.verifyTimeSlotExists(id);
    const games = this.gameSchedule.gameCountOnTimeSlot(id);
    if (games > 0)
      throw new Refusal('time-slot-has-games', { rank: this.rankOfTimeSlot(id), games });
    this.day = this.day.afterRemoving(id);
    this.allGameMasters = this.allGameMasters.afterReplacingEach((gameMaster) =>
      gameMaster.afterWithdrawingAvailability(id),
    );
  }

  /** Nombre de MJ disponibles sur le créneau. */
  availabilityCountOnTimeSlot(timeSlotId: string): number {
    return this.allGameMasters.inNaturalOrder.filter((gameMaster) =>
      gameMaster.isAvailableOnTimeSlot(timeSlotId),
    ).length;
  }

  /** Les tables, dans l'ordre naturel : « Table 2 » avant « Table 10 ». */
  get tables(): readonly Table[] {
    return this.allTables.inNaturalOrder;
  }

  /** Ajoute une table, au nom obligatoire, borné et unique dans la convention (PR-9). */
  addTable(id: string, name: string): void {
    this.allTables = this.allTables.afterAdding(new Table(id, ComparableName.of(name)));
  }

  /** Renomme une table, même si elle porte des parties. */
  renameTable(id: string, name: string): void {
    this.allTables = this.allTables.afterReplacing(new Table(id, ComparableName.of(name)));
  }

  /** Supprime une table. Une table qui porte des parties reste (PR-10). */
  removeTable(id: string): void {
    const table = this.allTables.existingItem(id);
    const games = this.gameSchedule.gameCountAtTable(id);
    if (games > 0) throw new Refusal('table-has-games', { name: table.name.text, games });
    this.allTables = this.allTables.afterRemoving(id);
  }

  /** Les MJ, dans l'ordre naturel de leur pseudo. */
  get gameMasters(): readonly GameMaster[] {
    return this.allGameMasters.inNaturalOrder;
  }

  /**
   * Ajoute un MJ, avec son participant (`participantId`), au pseudo obligatoire, borné et unique
   * dans la convention, parmi les MJ comme parmi les participants (PR-12, ID-4, ID-7, ADR 0012).
   */
  addGameMaster(id: string, participantId: string, nickname: string): void {
    const gameMaster = new GameMaster(
      id,
      new Participant(participantId, ComparableName.of(nickname)),
    );
    const gameMasters = this.allGameMasters.afterAdding(gameMaster);
    this.allParticipants = this.allParticipants.afterAdding(gameMaster.participant);
    this.allGameMasters = gameMasters;
  }

  /**
   * Change le pseudo d'un MJ, à tout moment, aux mêmes règles qu'à sa création : celui de son
   * participant, dont les téléphones restent reliés (PR-12).
   */
  renameGameMaster(id: string, nickname: string): void {
    const renamed = this.allGameMasters.existingItem(id).afterRenaming(ComparableName.of(nickname));
    const gameMasters = this.allGameMasters.afterReplacing(renamed);
    this.allParticipants = this.allParticipants.afterReplacing(renamed.participant);
    this.allGameMasters = gameMasters;
  }

  /**
   * Supprime un MJ, et avec lui ses disponibilités et son participant, donc ses téléphones reliés et
   * ses inscriptions. Un MJ qui a au moins un scénario reste (PR-12) : le catalogue, entier, le dit.
   */
  removeGameMaster(id: string, catalogue: ScenarioCatalogue): void {
    const gameMaster = this.allGameMasters.existingItem(id);
    const scenarios = catalogue.scenarioCountOfGameMaster(id);
    if (scenarios > 0) throw new Refusal('game-master-has-scenarios', { scenarios });
    this.allGameMasters = this.allGameMasters.afterRemoving(id);
    this.allParticipants = this.allParticipants.afterRemoving(gameMaster.participant.id);
    this.allSignUps = this.allSignUps.filter(
      (signUp) => signUp.participantId !== gameMaster.participant.id,
    );
  }

  /** Le MJ se déclare disponible sur un créneau existant (PR-2). Déclarer deux fois ne change rien. */
  declareAvailability(gameMasterId: string, timeSlotId: string): void {
    const gameMaster = this.allGameMasters.existingItem(gameMasterId);
    this.day.verifyTimeSlotExists(timeSlotId);
    this.allGameMasters = this.allGameMasters.afterReplacing(
      gameMaster.afterDeclaringAvailability(timeSlotId),
    );
  }

  /**
   * Retire la disponibilité du MJ sur un créneau existant, sauf s'il y mène une partie (PR-15).
   * Retirer une absente ne change rien.
   */
  withdrawAvailability(gameMasterId: string, timeSlotId: string): void {
    const gameMaster = this.allGameMasters.existingItem(gameMasterId);
    this.day.verifyTimeSlotExists(timeSlotId);
    const refusal = this.withdrawalRefusalOf(gameMaster, timeSlotId);
    if (refusal) throw refusal;
    this.allGameMasters = this.allGameMasters.afterReplacing(
      gameMaster.afterWithdrawingAvailability(timeSlotId),
    );
  }

  /**
   * Le verdict de retrait de chaque disponibilité du MJ, dans l'ordre de la journée : le refus que
   * `withdrawAvailability()` y lèverait, ou `null`.
   */
  withdrawalsOfGameMaster(gameMasterId: string): Withdrawal[] {
    const gameMaster = this.allGameMasters.existingItem(gameMasterId);
    return this.day.timeSlots
      .filter((slot) => gameMaster.isAvailableOnTimeSlot(slot.id))
      .map((slot) => ({
        timeSlotId: slot.id,
        refusal: this.withdrawalRefusalOf(gameMaster, slot.id),
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
  scenarioHasGames(scenarioId: string): boolean {
    return this.gameSchedule.scenarioHasGames(scenarioId);
  }

  /** Le programme : les parties, dans l'ordre de leur programmation. */
  get games(): readonly Game[] {
    return this.gameSchedule.games;
  }

  /**
   * Programme le scénario sur un créneau et une table (PR-3), dans le respect de PR-5. Une partie
   * double se programme sur son premier créneau, et prend le suivant, à la même table.
   */
  schedule(id: string, scenario: Scenario, timeSlotId: string, tableId: string): void {
    this.replaceScheduleAndSignUps(
      this.acceptedOrThrown(this.scheduleAfterScheduling(id, scenario, timeSlotId, tableId)),
    );
  }

  /**
   * Déplace la partie sur un créneau et une table (PR-17), dans le respect de PR-5, sans compter la
   * partie elle-même. Une partie double se déplace par son premier créneau, et prend le suivant.
   * Elle reste la même partie, à son rang dans le programme. Sur un autre créneau, elle perd ses
   * inscriptions ; à une autre table du même créneau, elle les garde (IN-6). Rend les
   * notifications de ses inscrits (`movedGameNotifications()`).
   */
  moveGame(gameId: string, timeSlotId: string, tableId: string): Notification[] {
    const game = this.gameSchedule.existingGame(gameId);
    const next = this.acceptedOrThrown(this.scheduleAfterMoving(game, timeSlotId, tableId));
    const notifications = this.movedGameNotifications(next, [game]);
    this.replaceScheduleAndSignUps(next);
    return notifications;
  }

  /**
   * Échange deux parties (PR-17) : chacune prend le premier créneau et la table de l'autre, en un
   * seul geste. Les deux places sont vérifiées ensemble contre PR-5, sans compter les deux parties à
   * leur ancienne place. Chacune reste la même partie, à son rang dans le programme. Échangées entre
   * deux créneaux, elles perdent leurs inscriptions ; sur un même créneau, elles les gardent (IN-6).
   * Rend les notifications des inscrits de chacune (`movedGameNotifications()`) : un inscrit aux
   * deux en reçoit une par partie.
   */
  swapGames(gameId: string, otherGameId: string): Notification[] {
    const game = this.gameSchedule.existingGame(gameId);
    const other = this.gameSchedule.existingGame(otherGameId);
    const next = this.acceptedOrThrown(this.scheduleAfterSwapping(game, other));
    const notifications = this.movedGameNotifications(next, [game, other]);
    this.replaceScheduleAndSignUps(next);
    return notifications;
  }

  /**
   * Déprogramme la partie (PR-17) : son scénario reste proposé, et revient dans la réserve. Elle
   * perd ses inscriptions (IN-6). Rend les notifications de ses inscrits et de son MJ (NO-2), qui
   * courent jusqu'à la fin de son dernier créneau (NO-3). Le MJ ne reçoit que la sienne : son
   * inscription à sa propre partie ne compte pas (IN-4, NO-1).
   */
  unschedule(gameId: string): Notification[] {
    const game = this.gameSchedule.existingGame(gameId);
    const signedUp = this.countingSignUpParticipantIdsOf(game);
    this.replaceScheduleAndSignUps(this.gameSchedule.afterUnscheduling(gameId));
    const params = { scenarioId: game.scenarioId, ranks: this.ranksOf(game.timeSlotIds) };
    const deadline = this.endOfTimeSlots(game.timeSlotIds);
    const gameMaster = this.allGameMasters.existingItem(game.gameMasterId);
    const toGameMaster: Notification = {
      code: 'own-game-unscheduled',
      params,
      recipients: participants([gameMaster.participant.id]),
      deadline,
    };
    if (!signedUp.length) return [toGameMaster];
    return [
      { code: 'game-unscheduled', params, recipients: participants(signedUp), deadline },
      toGameMaster,
    ];
  }

  /**
   * Le verdict de chaque case créneaux × tables pour le scénario : le refus que `schedule()` y
   * lèverait, ou `null`. Dans l'ordre des créneaux, puis des tables.
   */
  placementsOfScenario(scenario: Scenario): Placement[] {
    return this.day.timeSlots.flatMap((slot) =>
      this.tables.map((table) => ({
        timeSlotId: slot.id,
        tableId: table.id,
        refusal: this.refusalOrNull(
          this.scheduleAfterScheduling(HYPOTHETICAL_GAME_ID, scenario, slot.id, table.id),
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
  movePlacementsOfGame(gameId: string): MovePlacement[] {
    const game = this.gameSchedule.existingGame(gameId);
    return this.day.timeSlots.flatMap((slot) =>
      this.tables.map((table) => {
        const other = this.gameSchedule.otherGameStartingAtTimeSlotAndTable(
          game,
          slot.id,
          table.id,
        );
        return {
          timeSlotId: slot.id,
          tableId: table.id,
          swapWith: other?.id ?? null,
          refusal: this.refusalOrNull(
            other
              ? this.scheduleAfterSwapping(game, other)
              : this.scheduleAfterMoving(game, slot.id, table.id),
          ),
        };
      }),
    );
  }

  /** La réserve (PR-6) : voir `reserveOfEachScenario()`. */
  reserve(catalogue: ScenarioCatalogue): ReserveOfScenario[] {
    return reserveOfEachScenario(catalogue, this.day, this.gameSchedule, this.allGameMasters);
  }

  /** Les inscriptions, dans l'ordre où elles ont été prises. */
  get signUps(): readonly SignUp[] {
    return this.allSignUps;
  }

  /**
   * Inscrit le participant à la partie (IN-2), tant que le tirage de son créneau n'est pas lancé.
   * Plusieurs inscriptions sur un même créneau sont permises. Une partie double compte sur ses deux
   * créneaux, et ne touche pas aux inscriptions prises sur son second créneau (IN-3, TI-3). Rend
   * `false` si le participant y était déjà inscrit : rien ne change.
   */
  signUp(participantId: string, gameId: string): boolean {
    const signUp = this.signUpAllowedFor(participantId, gameId);
    if (this.allSignUps.some((existing) => existing.equals(signUp))) return false;
    this.allSignUps = [...this.allSignUps, signUp];
    return true;
  }

  /**
   * Retire l'inscription du participant à la partie (IN-2), tant que le tirage de son créneau n'est
   * pas lancé. Rend `false` s'il n'y était pas inscrit : rien ne change.
   */
  withdraw(participantId: string, gameId: string): boolean {
    const signUp = this.signUpAllowedFor(participantId, gameId);
    const remaining = this.allSignUps.filter((existing) => !existing.equals(signUp));
    if (remaining.length === this.allSignUps.length) return false;
    this.allSignUps = remaining;
    return true;
  }

  /**
   * La situation du participant : ses inscriptions, sauf celles qui ne comptent pas (IN-4), puis
   * l'état de chaque créneau, dans l'ordre de la journée, avec le résultat de son tirage.
   */
  situationOf(participantId: string): ParticipantSituation {
    const participant = this.allParticipants.existingItem(participantId);
    return {
      signedUpGameIds: this.allSignUps
        .filter((signUp) => signUp.participantId === participant.id && !this.isSuspended(signUp))
        .map(({ gameId }) => gameId),
      timeSlots: this.day.timeSlots.map((slot) => ({
        timeSlotId: slot.id,
        state: this.stateOfTimeSlot(slot.id),
        // Le tirage n'existe pas encore : aucun résultat.
        drawResult: null,
      })),
    };
  }

  /** L'inscription ne compte pas : voir `Convention.isSignUpSuspended()`. */
  private isSuspended(signUp: SignUp): boolean {
    const gameMaster = this.gameMasterOfParticipant(signUp.participantId);
    if (!gameMaster) return false;
    return Convention.isSignUpSuspended(
      this.gameSchedule.existingGame(signUp.gameId).timeSlotIds,
      this.gameSchedule.timeSlotIdsLedBy(gameMaster.id),
    );
  }

  /**
   * « Partie déplacée » pour chacune de ces parties qui passe à d'autres créneaux dans `next`, à ses
   * inscrits dont l'inscription compte (IN-4, IN-6). Elle court jusqu'à la fin du plus tardif de ses
   * anciens et nouveaux créneaux (NO-3). À lire avant le remplacement : il efface ces inscriptions.
   */
  private movedGameNotifications(next: Schedule, games: readonly Game[]): Notification[] {
    return games.flatMap((game) => {
      const signedUp = this.countingSignUpParticipantIdsOf(game);
      if (next.keepsSignUpsOf(game) || !signedUp.length) return [];
      const moved = next.existingGame(game.id);
      return [
        {
          code: 'game-moved',
          params: {
            gameId: game.id,
            scenarioId: game.scenarioId,
            fromRanks: this.ranksOf(game.timeSlotIds),
            toRanks: this.ranksOf(moved.timeSlotIds),
          },
          recipients: participants(signedUp),
          deadline: this.endOfTimeSlots([...game.timeSlotIds, ...moved.timeSlotIds]),
        },
      ];
    });
  }

  /** Les participants inscrits à la partie, dans l'ordre de leur inscription, sauf ceux dont l'inscription ne compte pas (IN-4). */
  private countingSignUpParticipantIdsOf(game: Game): string[] {
    return this.allSignUps
      .filter((signUp) => signUp.gameId === game.id && !this.isSuspended(signUp))
      .map(({ participantId }) => participantId);
  }

  /** Les rangs des créneaux, dans l'ordre donné. */
  private ranksOf(timeSlotIds: readonly string[]): number[] {
    return timeSlotIds.map((slotId) => this.rankOfTimeSlot(slotId));
  }

  /** La fin du dernier de ces créneaux, le jour de la convention, ou `null` sans date. */
  private endOfTimeSlots(timeSlotIds: readonly string[]): LocalMoment | null {
    return Convention.endOf(
      this.state.date,
      timeSlotIds.map((slotId) => this.day.existingTimeSlot(slotId).end),
    );
  }

  /** L'état du créneau. Le tirage n'existant pas encore, ses inscriptions restent ouvertes. */
  private stateOfTimeSlot(_timeSlotId: string): TimeSlotState {
    return 'sign-ups-open';
  }

  /**
   * L'inscription du participant à la partie, qui doivent exister, ou le refus du geste : le tirage
   * de son créneau est lancé. Une partie double est tirée avec son premier créneau (TI-3).
   */
  private signUpAllowedFor(participantId: string, gameId: string): SignUp {
    const participant = this.allParticipants.existingItem(participantId);
    const game = this.gameSchedule.existingGame(gameId);
    const firstTimeSlotId = game.timeSlotIds[0]!;
    if (this.stateOfTimeSlot(firstTimeSlotId) !== 'sign-ups-open') {
      throw new Refusal('sign-ups-closed', { rank: this.rankOfTimeSlot(firstTimeSlotId) });
    }
    return new SignUp(participant.id, game.id);
  }

  /** Le Programme après la programmation du scénario sur cette case, ou le refus de PR-5. */
  private scheduleAfterScheduling(
    id: string,
    scenario: Scenario,
    timeSlotId: string,
    tableId: string,
  ): Schedule | Refusal {
    this.day.verifyTimeSlotExists(timeSlotId);
    return this.gameSchedule.afterScheduling(
      id,
      scenario,
      timeSlotId,
      this.existingPlacementCollaborators(scenario.gameMasterId, tableId),
      this.day,
    );
  }

  /** Le Programme après le déplacement de la partie sur cette case, ou le refus de PR-5. */
  private scheduleAfterMoving(game: Game, timeSlotId: string, tableId: string): Schedule | Refusal {
    this.day.verifyTimeSlotExists(timeSlotId);
    return this.gameSchedule.afterMoving(
      game,
      timeSlotId,
      this.existingPlacementCollaborators(game.gameMasterId, tableId),
      this.day,
    );
  }

  /** Le Programme après l'échange des deux parties, ou le refus de PR-5. */
  private scheduleAfterSwapping(game: Game, other: Game): Schedule | Refusal {
    return this.gameSchedule.afterSwapping(
      game,
      this.existingPlacementCollaborators(game.gameMasterId, other.tableId),
      other,
      this.existingPlacementCollaborators(other.gameMasterId, game.tableId),
      this.day,
    );
  }

  /** Le MJ et la table d'une partie, qui doivent exister. */
  private existingPlacementCollaborators(
    gameMasterId: string,
    tableId: string,
  ): PlacementCollaborators {
    const table = this.allTables.existingItem(tableId);
    return { gameMaster: this.allGameMasters.existingItem(gameMasterId), table };
  }

  /**
   * Remplace le Programme. Une partie déprogrammée, ou qui passe sur d'autres créneaux, perd ses
   * inscriptions ; changer de table les garde (IN-6).
   */
  private replaceScheduleAndSignUps(next: Schedule): void {
    this.allSignUps = this.allSignUps.filter(({ gameId }) =>
      next.keepsSignUpsOf(this.gameSchedule.existingGame(gameId)),
    );
    this.gameSchedule = next;
  }

  /** Le Programme accepté, ou lève son refus. */
  private acceptedOrThrown(result: Schedule | Refusal): Schedule {
    if (result instanceof Refusal) throw result;
    return result;
  }

  /** Le refus d'un geste, ou `null` s'il est permis : le verdict. */
  private refusalOrNull(result: Schedule | Refusal): Refusal | null {
    return result instanceof Refusal ? result : null;
  }

  /** La règle PR-15 du retrait d'une disponibilité, la même pour l'écriture et pour le verdict. */
  private withdrawalRefusalOf(gameMaster: GameMaster, timeSlotId: string): Refusal | null {
    if (!this.gameSchedule.gameMasterRunsGameOnTimeSlot(gameMaster.id, timeSlotId)) return null;
    return new Refusal('availability-has-game', {
      nickname: gameMaster.nickname.text,
      rank: this.rankOfTimeSlot(timeSlotId),
    });
  }

  /** Refuse une journée qui couperait une partie double (PR-11), et la renvoie sinon. */
  private verifyTwoSlotGamesStayConsecutive(nextDay: Day): Day {
    this.gameSchedule.verifyTwoSlotGamesStayConsecutive(this.day, nextDay);
    return nextDay;
  }
}

/** Des destinataires désignés par leur identifiant de participant. */
function participants(participantIds: string[]): Notification['recipients'] {
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
 * place (`unassigned`). `null` tant que le tirage n'est pas publié, ou sans inscription.
 */
export type DrawResult = { kind: 'assigned'; gameId: string } | { kind: 'unassigned' } | null;

/** La situation d'un participant : voir `Convention.situationOf()`. */
export type ParticipantSituation = {
  signedUpGameIds: string[];
  timeSlots: { timeSlotId: string; state: TimeSlotState; drawResult: DrawResult }[];
};

/** Le verdict d'une case créneau × table pour un scénario : le refus d'écriture, ou `null`. */
export type Placement = { timeSlotId: string; tableId: string; refusal: Refusal | null };

/**
 * Le verdict d'une case créneau × table pour déplacer une partie : `swapWith`, l'id de la partie
 * avec laquelle l'échanger, ou `null` pour un déplacement ; le refus d'écriture, ou `null`.
 */
export type MovePlacement = Placement & { swapWith: string | null };

/** Le verdict de retrait d'une disponibilité : le refus d'écriture, ou `null`. */
export type Withdrawal = { timeSlotId: string; refusal: Refusal | null };

/** Le nom d'une table : obligatoire, borné, unique dans la convention (PR-9). */
const TABLE_NAMING_RULES: NamingRules<Table> = {
  nameOf: (table) => table.name,
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
  nameOf: (gameMaster) => gameMaster.nickname,
  maxLength: Convention.NICKNAME_MAX_LENGTH,
  refuseMissingItem: () => new Refusal('game-master-not-found', {}),
  refuseEmptyName: () => new Refusal('nickname-required', {}),
  refuseTooLongName: (max) => new Refusal('nickname-too-long', { max }),
  refuseTakenName: (namesake) =>
    new Refusal('nickname-taken', { nickname: namesake.nickname.text }),
};

/**
 * Le pseudo d'un participant, MJ compris : obligatoire, borné, unique parmi les participants (ID-1,
 * ID-4, ID-7). `identify()` relie un pseudo déjà pris au lieu de le refuser ; seuls l'ajout et le
 * renommage d'un MJ le refusent, une fois écarté un autre MJ (PR-12).
 */
const PARTICIPANT_NICKNAME_RULES: NamingRules<Participant> = {
  nameOf: (participant) => participant.nickname,
  maxLength: Convention.NICKNAME_MAX_LENGTH,
  refuseMissingItem: () => new Refusal('participant-not-found', {}),
  refuseEmptyName: () => new Refusal('nickname-required', {}),
  refuseTooLongName: (max) => new Refusal('nickname-too-long', { max }),
  refuseTakenName: (namesake) =>
    new Refusal('nickname-taken-by-participant', { nickname: namesake.nickname.text }),
};
