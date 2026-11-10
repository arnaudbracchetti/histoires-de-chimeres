import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { DrawStage } from './convention.js';
import type { Day } from './day.js';
import { isReachedAt, type LocalMoment } from './local-moment.js';
import type { Game } from './game.js';
import type { Participant } from './participant.js';
import { Assignment, Draw } from './draw.js';
import type {
  DrawAlgorithm,
  DrawInput,
  DrawOutput,
  DrawParticipant,
  RandomSource,
} from './draw-algorithm.js';
import type { Schedule } from './schedule.js';
import type { ScheduleChange } from './schedule-change.js';
import type { LedGames } from './led-games.js';
import type { MergeOutcome, SignUpCollaborators, SignUps } from './sign-ups.js';

/**
 * Ce que le lancement lit hors des Tirages : la Journée, les Inscriptions et leurs collaborateurs,
 * le catalogue, entier, qui donne les places des parties, et le participant de chaque MJ, qui entre
 * au tirage quand sa partie est annulée.
 */
export type DrawCollaborators = {
  day: Day;
  signUps: SignUps;
  signUpCollaborators: SignUpCollaborators;
  catalogue: ScenarioCatalogue;
  findExistingParticipantIdOfGameMaster(gameMasterId: string): string;
};

/** Ce que l'annulation d'une partie lit hors des Tirages : la Journée, le catalogue, entier, et le
 * participant du MJ de la partie. */
export type GameCancellationCollaborators = {
  day: Day;
  catalogue: ScenarioCatalogue;
  gameMasterParticipantId: string;
};

/**
 * Ce que l'ajout d'un retardataire lit hors des Tirages : la Journée et la date de la convention,
 * qui disent si le créneau est terminé, le Programme, qui donne les créneaux des parties doubles,
 * et les parties que mène chaque participant (IN-4).
 */
export type LatecomerCollaborators = {
  day: Day;
  date: string | null;
  schedule: Schedule;
  ledGames: LedGames;
};

/**
 * Ce que la fusion d'un pseudo lit hors des Tirages : le Programme, qui donne les créneaux des
 * parties doubles, et les parties non annulées que mène chaque participant (IN-4).
 */
export type MergeCollaborators = { schedule: Schedule; ledGames: LedGames };

/**
 * Ce que la fusion d'un pseudo fait de son affectation dans le tirage d'un créneau (ID-11) : sa
 * partie, ou `null` s'il n'est pas placé, et son sort. `destinationLeftTimeSlotIds` : les créneaux
 * dont la destination quitte le tirage, parce qu'elle prend la partie double de la source (TI-3).
 */
export type AssignmentMerge = {
  timeSlotId: string;
  gameId: string | null;
  outcome: MergeOutcome;
  destinationLeftTimeSlotIds: string[];
};

/** Ce que le rétablissement d'une partie lit hors des Tirages. */
export type GameRestorationCollaborators = Omit<GameCancellationCollaborators, 'catalogue'>;

/**
 * La sortie de l'algorithme de tirage ne respecte pas son contrat : c'est une erreur interne, pas
 * un refus. Rien n'est sauvegardé.
 */
export class FaultyDrawOutputError extends Error {
  constructor(reason: string) {
    super(`Sortie de l'algorithme de tirage fautive : ${reason}`);
    this.name = 'FaultyDrawOutputError';
  }
}

/**
 * Tirages : un tirage par créneau lancé (ADR 0013). Ils donnent l'état de chaque créneau, et
 * gardent l'ordre des tirages. Immuables : chaque geste rend d'autres Tirages.
 */
export class Draws {
  private constructor(readonly draws: readonly Draw[]) {}

  static createFromDraws(draws: Iterable<Draw>): Draws {
    return new Draws([...draws]);
  }

  /** Le tirage du créneau, ou `undefined` tant qu'il n'est pas lancé. */
  findDrawOfTimeSlot(timeSlotId: string): Draw | undefined {
    return this.draws.find((draw) => draw.timeSlotId === timeSlotId);
  }

  /** Sans tirage, inscriptions ouvertes ; tirage provisoire, `drawing` ; tirage publié, `published`. */
  getDrawStage(timeSlotId: string): DrawStage {
    const draw = this.findDrawOfTimeSlot(timeSlotId);
    if (!draw) return 'sign-ups-open';
    return draw.published ? 'published' : 'drawing';
  }

  /**
   * Les Tirages après le lancement de celui du créneau (TI-1), le premier dont le tirage n'est pas
   * publié. Les participants du tirage sont ceux qui ont une inscription active (IN-4) sur une
   * partie qui commence sur le créneau, et les participants sans partie du créneau : le MJ qui y
   * mène n'en est pas (TI-2). L'algorithme reçoit ces participants et ces parties, avec leurs
   * places ; sa sortie est vérifiée.
   */
  getDrawsAfterLaunchingDraw(
    timeSlotId: string,
    algorithm: DrawAlgorithm,
    random: RandomSource,
    collaborators: DrawCollaborators,
  ): Draws {
    this.verifyDrawLaunchable(timeSlotId, collaborators.day);
    const draw = buildDraw(timeSlotId, [], algorithm, random, collaborators);
    return new Draws([...this.draws, draw]);
  }

  /**
   * Les Tirages après la relance du tirage provisoire du créneau (TI-6) : un nouveau tirage, comme
   * au lancement, qui relit les participants, leurs inscriptions actives et les places. Les
   * déplacements à la main sont effacés ; les parties annulées le restent.
   */
  getDrawsAfterRerunningDraw(
    timeSlotId: string,
    algorithm: DrawAlgorithm,
    random: RandomSource,
    collaborators: DrawCollaborators,
  ): Draws {
    const draw = this.findExistingProvisionalDraw(timeSlotId, collaborators.day);
    return this.getDrawsAfterReplacingDraw(
      buildDraw(timeSlotId, draw.cancelledGameIds, algorithm, random, collaborators),
    );
  }

  /**
   * Les Tirages sans le tirage provisoire du créneau, dont les inscriptions rouvrent (TI-6). Les
   * participants sans partie, rangés dans les Inscriptions, restent.
   */
  getDrawsAfterReopeningSignUps(timeSlotId: string, day: Day): Draws {
    this.verifyDrawProvisional(timeSlotId, day);
    return new Draws(this.draws.filter((draw) => draw.timeSlotId !== timeSlotId));
  }

  /**
   * Les Tirages après un changement du Programme (TI-6) : le tirage provisoire d'un créneau dont le
   * changement modifie les parties est effacé, annulations comprises, et ses inscriptions rouvrent.
   * Un changement de table ou un échange sur le même créneau le garde : les joueurs suivent leur
   * partie. Un tirage publié reste.
   */
  getDrawsAfterChangingSchedule(change: ScheduleChange): Draws {
    const erased = new Set(this.listProvisionalTimeSlotIdsErasedBy(change));
    if (!erased.size) return this;
    return new Draws(this.draws.filter((draw) => !erased.has(draw.timeSlotId)));
  }

  /**
   * Le créneau dont le changement du Programme effacerait le tirage provisoire, ou `null`. Les
   * tirages se lancent dans l'ordre de la journée : un seul est provisoire à la fois.
   */
  findProvisionalTimeSlotIdErasedBy(change: ScheduleChange): string | null {
    return this.listProvisionalTimeSlotIdsErasedBy(change)[0] ?? null;
  }

  /**
   * Les créneaux que le participant occupe comme joueur d'une partie double, placé par un tirage
   * publié : ceux qui suivent le premier créneau de la partie (TI-3). Le Programme donne les
   * créneaux des parties.
   */
  listTimeSlotIdsPlayedByParticipant(participantId: string, schedule: Schedule): string[] {
    return this.draws
      .filter((draw) => draw.published)
      .flatMap((draw) => draw.assignments)
      .filter((assignment) => assignment.participantId === participantId && assignment.gameId)
      .flatMap(({ gameId }) => schedule.findGameById(gameId!)?.timeSlotIds.slice(1) ?? []);
  }

  /**
   * Le participant est placé sur le créneau : dans une partie du tirage, provisoire ou publié, de ce
   * créneau, ou dans une partie double qui s'y poursuit (TI-3).
   */
  isParticipantPlacedOnTimeSlot(
    participantId: string,
    timeSlotId: string,
    schedule: Schedule,
  ): boolean {
    return Boolean(
      this.findDrawOfTimeSlot(timeSlotId)?.findAssignmentOfParticipant(participantId)?.gameId ||
      this.findAssignmentContinuingOnTimeSlot(participantId, timeSlotId, schedule),
    );
  }

  /**
   * L'affectation du participant à une partie double qui se poursuit sur ce créneau, placé par le
   * tirage, provisoire ou publié, de son premier créneau (TI-3) ; sinon `undefined`.
   */
  findAssignmentContinuingOnTimeSlot(
    participantId: string,
    timeSlotId: string,
    schedule: Schedule,
  ): Assignment | undefined {
    return this.draws
      .map((draw) => draw.findAssignmentOfParticipant(participantId))
      .find(
        (assignment) =>
          assignment?.gameId &&
          schedule.findGameById(assignment.gameId)?.timeSlotIds.slice(1).includes(timeSlotId),
      );
  }

  /**
   * Les Tirages après l'annulation de la partie (TI-6), dans le tirage provisoire de son premier
   * créneau : ses joueurs passent non placés, et le participant de son MJ entre au tirage, non
   * placé. Refuse une partie déjà annulée, puis une partie qui a au moins le minimum de joueurs de
   * son scénario, que le catalogue, entier, donne : une partie sans joueur s'annule.
   */
  getDrawsAfterCancellingGame(game: Game, collaborators: GameCancellationCollaborators): Draws {
    const { day, catalogue, gameMasterParticipantId } = collaborators;
    const draw = this.findExistingProvisionalDraw(game.timeSlotIds[0]!, day);
    if (draw.isGameCancelled(game.id)) throw new Refusal('game-already-cancelled', {});
    const { minSeats } = catalogue.findExistingEntryById(game.scenarioId);
    if (!draw.hasGameBelowMinimum(game.id, minSeats)) {
      const players = draw.countPlayersOfGame(game.id);
      throw new Refusal('game-not-below-minimum', { players, min: minSeats });
    }
    return this.getDrawsAfterReplacingDraw(
      draw.getDrawAfterCancellingGame(game.id, gameMasterParticipantId),
    );
  }

  /**
   * Les Tirages après le rétablissement de la partie annulée (TI-6) : elle revient sans joueur, et
   * le participant de son MJ sort du tirage. Refuse une partie qui n'est pas annulée.
   */
  getDrawsAfterRestoringGame(game: Game, collaborators: GameRestorationCollaborators): Draws {
    const { day, gameMasterParticipantId } = collaborators;
    const draw = this.findExistingProvisionalDraw(game.timeSlotIds[0]!, day);
    if (!draw.isGameCancelled(game.id)) throw new Refusal('game-not-cancelled', {});
    return this.getDrawsAfterReplacingDraw(
      draw.getDrawAfterRestoringGame(game.id, gameMasterParticipantId),
    );
  }

  /**
   * Les Tirages après le déplacement du participant dans le tirage provisoire du créneau (TI-6) :
   * vers une partie qui commence sur le créneau, ou vers les non placés pour `null`. Il est marqué
   * « déplacé à la main ». Une partie où il n'est pas inscrit, ou au-delà de son maximum, est
   * permise. Refuse un participant hors du tirage, puis une partie d'un autre créneau, puis une
   * partie annulée.
   */
  getDrawsAfterMovingParticipant(
    timeSlotId: string,
    participant: Participant,
    game: Game | null,
    day: Day,
  ): Draws {
    const draw = this.findExistingProvisionalDraw(timeSlotId, day);
    const rank = day.getTimeSlotRank(timeSlotId);
    if (!draw.hasParticipant(participant.id)) {
      throw new Refusal('participant-not-in-draw', { nickname: participant.nickname.text, rank });
    }
    if (game) {
      if (game.timeSlotIds[0] !== timeSlotId) throw new Refusal('game-not-on-time-slot', { rank });
      if (draw.isGameCancelled(game.id)) throw new Refusal('game-cancelled', {});
    }
    return this.getDrawsAfterReplacingDraw(
      draw.getDrawAfterMovingParticipant(participant.id, game?.id ?? null),
    );
  }

  /**
   * Les Tirages après la publication du tirage provisoire du créneau (TI-7) : son résultat est
   * figé. Refuse un tirage dont une partie non annulée qui commence sur le créneau, dans le
   * Programme, n'a aucun joueur : son MJ resterait seul à sa table.
   */
  getDrawsAfterPublishingDraw(timeSlotId: string, day: Day, schedule: Schedule): Draws {
    const draw = this.findExistingProvisionalDraw(timeSlotId, day);
    const withoutPlayers = schedule
      .listGamesStartingOnTimeSlot(timeSlotId)
      .filter((game) => !draw.isGameCancelled(game.id) && draw.countPlayersOfGame(game.id) === 0);
    if (withoutPlayers.length) {
      throw new Refusal('games-without-players', {
        rank: day.getTimeSlotRank(timeSlotId),
        games: withoutPlayers.length,
      });
    }
    return this.getDrawsAfterReplacingDraw(draw.getDrawAfterPublishing());
  }

  /**
   * Le refus d'un geste de programmation qui touche une partie de ces créneaux, pour le premier dont
   * le tirage est publié : son programme ne change plus (TI-7). `null` si aucun ne l'est.
   */
  findPublishedTimeSlotRefusal(timeSlotIds: readonly string[], day: Day): Refusal | null {
    const published = timeSlotIds.find(
      (timeSlotId) => this.getDrawStage(timeSlotId) === 'published',
    );
    if (!published) return null;
    return new Refusal('time-slot-published', { rank: day.getTimeSlotRank(published) });
  }

  /**
   * Refuse un créneau dont le tirage est lancé, provisoire ou publié : ses heures ne changent plus,
   * et il ne se supprime pas (PR-10, PR-11).
   */
  verifyTimeSlotNotDrawn(timeSlotId: string, day: Day): void {
    const state = this.getDrawStage(timeSlotId);
    if (state === 'sign-ups-open') return;
    throw new Refusal('time-slot-locked-by-draw', {
      rank: day.getTimeSlotRank(timeSlotId),
      published: state === 'published',
    });
  }

  /**
   * Refuse une journée où le créneau, non tiré, se place avant un créneau tiré : les tirages suivent
   * l'ordre de la journée (PR-11). Le refus nomme le premier créneau tiré qui le suivrait, par son
   * rang actuel : s'il est provisoire, c'est le seul tiré après lui, et rouvrir ses inscriptions
   * suffit.
   */
  verifyNoDrawAfterTimeSlot(timeSlotId: string, currentDay: Day, nextDay: Day): void {
    const following = nextDay.timeSlots.slice(nextDay.getTimeSlotRank(timeSlotId));
    const drawn = following.find((slot) => this.findDrawOfTimeSlot(slot.id));
    if (!drawn) return;
    throw new Refusal('time-slot-before-draw', {
      rank: currentDay.getTimeSlotRank(drawn.id),
      published: this.getDrawStage(drawn.id) === 'published',
    });
  }

  /** Le tirage publié du créneau, ou `undefined` tant qu'il ne l'est pas : son résultat se montre (§5.7). */
  findPublishedDrawOfTimeSlot(timeSlotId: string): Draw | undefined {
    const draw = this.findDrawOfTimeSlot(timeSlotId);
    return draw?.published ? draw : undefined;
  }

  /**
   * Le créneau est terminé : son tirage est publié, et son heure de fin passée, le jour de la
   * convention. Sans date, jamais.
   */
  hasTimeSlotEndedAt(timeSlotId: string, now: LocalMoment, day: Day, date: string | null): boolean {
    return (
      this.getDrawStage(timeSlotId) === 'published' &&
      isReachedAt(day.computeEndOfTimeSlots(date, [timeSlotId]), now)
    );
  }

  /**
   * Le refus d'ajouter le retardataire au tirage publié du créneau (ID-14), ou `undefined`. Refuse,
   * dans l'ordre : un créneau dont le tirage n'est pas publié, un créneau terminé, un participant
   * déjà dans ce tirage, placé ou non, un MJ qui mène une partie sur ce créneau (IN-4), un joueur
   * placé dans une partie double qui s'y poursuit (TI-3).
   */
  findLatecomerRefusal(
    participant: Participant,
    timeSlotId: string,
    now: LocalMoment,
    { day, date, schedule, ledGames }: LatecomerCollaborators,
  ): Refusal | undefined {
    const rank = day.getTimeSlotRank(timeSlotId);
    const draw = this.findPublishedDrawOfTimeSlot(timeSlotId);
    if (!draw) return new Refusal('draw-not-published', { rank });
    if (this.hasTimeSlotEndedAt(timeSlotId, now, day, date)) {
      return new Refusal('time-slot-ended', { rank });
    }
    const params = { nickname: participant.nickname.text, rank };
    if (draw.hasParticipant(participant.id))
      return new Refusal('latecomer-already-in-draw', params);
    if (ledGames.isParticipantLeadingOnTimeSlot(participant.id, timeSlotId)) {
      return new Refusal('latecomer-leads-on-time-slot', params);
    }
    if (this.findAssignmentContinuingOnTimeSlot(participant.id, timeSlotId, schedule)) {
      return new Refusal('latecomer-plays-two-slot-game', params);
    }
    return undefined;
  }

  /**
   * Les Tirages après l'ajout du retardataire au tirage publié du créneau, sans partie (ID-14). Les
   * places restantes ne changent pas. Refuse comme `findLatecomerRefusal()`.
   */
  getDrawsAfterAddingLatecomer(
    participant: Participant,
    timeSlotId: string,
    now: LocalMoment,
    collaborators: LatecomerCollaborators,
  ): Draws {
    const refusal = this.findLatecomerRefusal(participant, timeSlotId, now, collaborators);
    if (refusal) throw refusal;
    return this.getDrawsAfterReplacingDraw(
      this.findPublishedDrawOfTimeSlot(timeSlotId)!.getDrawAfterAddingUnassignedParticipant(
        participant.id,
      ),
    );
  }

  /** La partie est annulée dans un tirage : son MJ n'y mène plus (IN-4). */
  isGameCancelled(gameId: string): boolean {
    return this.draws.some((draw) => draw.isGameCancelled(gameId));
  }

  /**
   * Ce que la fusion de la source dans la destination fait des affectations de la source (ID-11),
   * un par tirage où elle en a une, dans l'ordre des tirages. Elle est perdue si la destination,
   * sur l'un des créneaux de sa partie, ou sur le créneau pour la source non placée, mène une
   * partie non annulée ou est placée, dans une partie double qui s'y poursuit comprise ; ou si
   * toutes deux sont non placées : la destination garde la sienne. Sinon la destination la reprend
   * entière, marque « déplacé à la main » comprise : une seule affectation reste. Prenant une partie
   * double, la destination quitte le tirage de ses créneaux suivants, où elle était non placée
   * (TI-3).
   */
  computeAssignmentMerges(
    sourceId: string,
    destinationId: string,
    { schedule, ledGames }: MergeCollaborators,
  ): AssignmentMerge[] {
    const isDestinationTakenOn = (timeSlotId: string) =>
      ledGames.isParticipantLeadingOnTimeSlot(destinationId, timeSlotId) ||
      this.isParticipantPlacedOnTimeSlot(destinationId, timeSlotId, schedule);
    return this.draws.flatMap((draw): AssignmentMerge[] => {
      const assignment = draw.findAssignmentOfParticipant(sourceId);
      if (!assignment) return [];
      const timeSlotIds = assignment.gameId
        ? schedule.findExistingGameById(assignment.gameId).timeSlotIds
        : [draw.timeSlotId];
      const lost =
        timeSlotIds.some(isDestinationTakenOn) ||
        (!assignment.gameId && draw.hasParticipant(destinationId));
      return [
        {
          timeSlotId: draw.timeSlotId,
          gameId: assignment.gameId,
          outcome: lost ? 'lost' : 'transferred',
          destinationLeftTimeSlotIds: lost
            ? []
            : timeSlotIds
                .slice(1)
                .filter((timeSlotId) =>
                  this.findDrawOfTimeSlot(timeSlotId)?.hasParticipant(destinationId),
                ),
        },
      ];
    });
  }

  /**
   * Les Tirages après la fusion de la source dans la destination (ID-11), selon
   * `computeAssignmentMerges()` : la source n'y est plus.
   */
  getDrawsAfterMergingParticipant(
    sourceId: string,
    destinationId: string,
    collaborators: MergeCollaborators,
  ): Draws {
    const merges = this.computeAssignmentMerges(sourceId, destinationId, collaborators);
    const left = new Set(merges.flatMap((merge) => merge.destinationLeftTimeSlotIds));
    return new Draws(
      this.draws.map((draw) => {
        const merge = merges.find(({ timeSlotId }) => timeSlotId === draw.timeSlotId);
        let next = draw;
        if (left.has(draw.timeSlotId)) next = next.getDrawAfterRemovingParticipant(destinationId);
        if (merge?.outcome === 'transferred') {
          next = next.getDrawAfterGivingAssignment(sourceId, destinationId);
        }
        return next.getDrawAfterRemovingParticipant(sourceId);
      }),
    );
  }

  /** Les Tirages sans les affectations du participant, qui disparaît (PR-12). */
  getDrawsAfterRemovingParticipant(participantId: string): Draws {
    return new Draws(this.draws.map((draw) => draw.getDrawAfterRemovingParticipant(participantId)));
  }

  /**
   * Refuse un créneau déjà lancé, ou publié, puis un créneau qu'un créneau d'avant, au tirage non
   * publié, précède : les tirages se font dans l'ordre de la journée.
   */
  private verifyDrawLaunchable(timeSlotId: string, day: Day): void {
    const rank = day.getTimeSlotRank(timeSlotId);
    const state = this.getDrawStage(timeSlotId);
    if (state === 'drawing') throw new Refusal('draw-already-launched', { rank });
    if (state === 'published') throw new Refusal('draw-published', { rank });
    const previous = day.timeSlots
      .slice(0, rank - 1)
      .find((slot) => this.getDrawStage(slot.id) !== 'published');
    if (previous) {
      throw new Refusal('previous-draw-not-published', {
        rank,
        previousRank: day.getTimeSlotRank(previous.id),
      });
    }
  }

  /** Refuse un créneau dont le tirage n'est pas lancé, puis un créneau dont le tirage est publié. */
  private verifyDrawProvisional(timeSlotId: string, day: Day): void {
    this.findExistingProvisionalDraw(timeSlotId, day);
  }

  /**
   * Le tirage provisoire du créneau. Refuse un créneau dont le tirage n'est pas lancé, puis un
   * créneau dont le tirage est publié.
   */
  private findExistingProvisionalDraw(timeSlotId: string, day: Day): Draw {
    const rank = day.getTimeSlotRank(timeSlotId);
    const draw = this.findDrawOfTimeSlot(timeSlotId);
    if (!draw) throw new Refusal('draw-not-launched', { rank });
    if (draw.published) throw new Refusal('draw-published', { rank });
    return draw;
  }

  /** Les créneaux en tirage provisoire dont le changement du Programme modifie les parties. */
  private listProvisionalTimeSlotIdsErasedBy(change: ScheduleChange): string[] {
    return change
      .listTimeSlotIdsWithChangedGames()
      .filter((timeSlotId) => this.getDrawStage(timeSlotId) === 'drawing');
  }

  /** Les Tirages, ce tirage à la place de celui de son créneau. */
  private getDrawsAfterReplacingDraw(replacement: Draw): Draws {
    return new Draws(
      this.draws.map((draw) => (draw.timeSlotId === replacement.timeSlotId ? replacement : draw)),
    );
  }
}

/**
 * Le tirage provisoire du créneau, tout frais, avec ces parties annulées : l'algorithme reçoit ses
 * participants et ses parties, avec leurs places ; sa sortie est vérifiée. Personne n'est déplacé
 * à la main.
 */
function buildDraw(
  timeSlotId: string,
  cancelledGameIds: readonly string[],
  algorithm: DrawAlgorithm,
  random: RandomSource,
  collaborators: DrawCollaborators,
): Draw {
  const input = buildDrawInput(timeSlotId, cancelledGameIds, collaborators);
  const output = algorithm.computeAssignments(input, random);
  verifyDrawOutput(input, output);
  const gameOf = new Map(output.map(({ participantId, gameId }) => [participantId, gameId]));
  return new Draw(
    timeSlotId,
    false,
    input.participants.map(({ id }) => new Assignment(id, gameOf.get(id)!, false)),
    cancelledGameIds,
  );
}

/**
 * L'entrée de l'algorithme : les parties qui commencent sur le créneau, sans les annulées, avec
 * leurs places ; ceux qui ont une inscription active sur une partie qui y commence, annulées
 * comprises, partie après partie, dans l'ordre de leur inscription ; puis les participants sans
 * partie du créneau (TI-3 et IN-4 les excluent comme les autres) ; puis les MJ des parties
 * annulées. Un participant qui n'a d'inscription qu'à des parties annulées y est, sans partie ; un
 * participant sans partie, aussi.
 */
function buildDrawInput(
  timeSlotId: string,
  cancelledGameIds: readonly string[],
  {
    signUps,
    signUpCollaborators,
    catalogue,
    findExistingParticipantIdOfGameMaster,
  }: DrawCollaborators,
): DrawInput {
  const starting = signUpCollaborators.schedule.listGamesStartingOnTimeSlot(timeSlotId);
  const cancelled = starting.filter((game) => cancelledGameIds.includes(game.id));
  const games = starting.filter((game) => !cancelled.includes(game));
  const gameIds = new Set(games.map((game) => game.id));
  const participantIds = new Set([
    ...starting.flatMap((game) =>
      signUps.listActiveParticipantIdsOfGame(game, signUpCollaborators),
    ),
    ...signUps.listParticipantIdsWithoutGameOnTimeSlot(timeSlotId, signUpCollaborators),
    ...cancelled.map((game) => findExistingParticipantIdOfGameMaster(game.gameMasterId)),
  ]);
  const participants = [...participantIds].map((id): DrawParticipant => ({
    id,
    gameIds: signUps
      .listActiveGameIdsOfParticipant(id, signUpCollaborators)
      .filter((gameId) => gameIds.has(gameId)),
  }));
  return {
    games: games.map((game) => {
      const { minSeats, maxSeats } = catalogue.findExistingEntryById(game.scenarioId);
      return { id: game.id, minSeats, maxSeats };
    }),
    participants,
  };
}

/**
 * Vérifie la sortie de l'algorithme : chaque participant de l'entrée y figure une fois, et lui
 * seul ; chacun est sur une partie de ses inscriptions, ou non placé ; aucune partie ne dépasse son
 * maximum.
 */
function verifyDrawOutput(input: DrawInput, output: DrawOutput): void {
  const participants = new Map(
    input.participants.map((participant) => [participant.id, participant]),
  );
  const seen = new Set<string>();
  const players = new Map<string, number>();
  for (const { participantId, gameId } of output) {
    const participant = participants.get(participantId);
    if (!participant) throw new FaultyDrawOutputError(`${participantId} hors de l'entrée`);
    if (seen.has(participantId)) throw new FaultyDrawOutputError(`${participantId} en double`);
    seen.add(participantId);
    if (gameId === null) continue;
    if (!participant.gameIds.includes(gameId)) {
      throw new FaultyDrawOutputError(`${participantId} hors de ses inscriptions`);
    }
    players.set(gameId, (players.get(gameId) ?? 0) + 1);
  }
  if (seen.size !== participants.size) throw new FaultyDrawOutputError('participant manquant');
  for (const game of input.games) {
    if ((players.get(game.id) ?? 0) > game.maxSeats) {
      throw new FaultyDrawOutputError(`${game.id} au-delà de son maximum`);
    }
  }
}
