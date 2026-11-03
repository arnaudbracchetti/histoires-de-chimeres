import { Refusal } from '../refusal.js';
import type { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import type { TimeSlotState } from './convention.js';
import type { Day } from './day.js';
import { Assignment, Draw } from './draw.js';
import type {
  DrawAlgorithm,
  DrawInput,
  DrawOutput,
  DrawParticipant,
  RandomSource,
} from './draw-algorithm.js';
import type { Schedule } from './schedule.js';
import type { SignUpCollaborators, SignUps } from './sign-ups.js';

/**
 * Ce que le lancement lit hors des Tirages : la Journée, les Inscriptions et leurs collaborateurs,
 * et le catalogue, entier, qui donne les places des parties.
 */
export type DrawCollaborators = {
  day: Day;
  signUps: SignUps;
  signUpCollaborators: SignUpCollaborators;
  catalogue: ScenarioCatalogue;
};

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
  getTimeSlotState(timeSlotId: string): TimeSlotState {
    const draw = this.findDrawOfTimeSlot(timeSlotId);
    if (!draw) return 'sign-ups-open';
    return draw.published ? 'published' : 'drawing';
  }

  /**
   * Les Tirages après le lancement de celui du créneau (TI-1), le premier dont le tirage n'est pas
   * publié. Les participants du tirage sont ceux qui ont une inscription active (IN-4) sur une
   * partie qui commence sur le créneau : le MJ qui y mène n'en est pas (TI-2). L'algorithme reçoit
   * ces participants et ces parties, avec leurs places ; sa sortie est vérifiée.
   */
  getDrawsAfterLaunchingDraw(
    timeSlotId: string,
    algorithm: DrawAlgorithm,
    random: RandomSource,
    collaborators: DrawCollaborators,
  ): Draws {
    this.verifyDrawLaunchable(timeSlotId, collaborators.day);
    const draw = buildDraw(timeSlotId, algorithm, random, collaborators);
    return new Draws([...this.draws, draw]);
  }

  /**
   * Les Tirages après la relance du tirage provisoire du créneau (TI-6) : un nouveau tirage, comme
   * au lancement, qui relit les participants, leurs inscriptions actives et les places. Les
   * déplacements à la main sont effacés.
   */
  getDrawsAfterRerunningDraw(
    timeSlotId: string,
    algorithm: DrawAlgorithm,
    random: RandomSource,
    collaborators: DrawCollaborators,
  ): Draws {
    this.verifyDrawProvisional(timeSlotId, collaborators.day);
    const rerun = buildDraw(timeSlotId, algorithm, random, collaborators);
    return new Draws(this.draws.map((draw) => (draw.timeSlotId === timeSlotId ? rerun : draw)));
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
    const state = this.getTimeSlotState(timeSlotId);
    if (state === 'drawing') throw new Refusal('draw-already-launched', { rank });
    if (state === 'published') throw new Refusal('draw-published', { rank });
    const previous = day.timeSlots
      .slice(0, rank - 1)
      .find((slot) => this.getTimeSlotState(slot.id) !== 'published');
    if (previous) {
      throw new Refusal('previous-draw-not-published', {
        rank,
        previousRank: day.getTimeSlotRank(previous.id),
      });
    }
  }

  /** Refuse un créneau dont le tirage n'est pas lancé, puis un créneau dont le tirage est publié. */
  private verifyDrawProvisional(timeSlotId: string, day: Day): void {
    const rank = day.getTimeSlotRank(timeSlotId);
    const state = this.getTimeSlotState(timeSlotId);
    if (state === 'sign-ups-open') throw new Refusal('draw-not-launched', { rank });
    if (state === 'published') throw new Refusal('draw-published', { rank });
  }
}

/**
 * Le tirage provisoire du créneau, tout frais : l'algorithme reçoit ses participants et ses
 * parties, avec leurs places ; sa sortie est vérifiée. Personne n'est déplacé à la main.
 */
function buildDraw(
  timeSlotId: string,
  algorithm: DrawAlgorithm,
  random: RandomSource,
  collaborators: DrawCollaborators,
): Draw {
  const input = buildDrawInput(timeSlotId, collaborators);
  const output = algorithm.computeAssignments(input, random);
  verifyDrawOutput(input, output);
  const gameOf = new Map(output.map(({ participantId, gameId }) => [participantId, gameId]));
  return new Draw(
    timeSlotId,
    false,
    input.participants.map(({ id }) => new Assignment(id, gameOf.get(id)!, false)),
  );
}

/**
 * L'entrée de l'algorithme : les parties qui commencent sur le créneau, avec leurs places, et ceux
 * qui y ont une inscription active, partie après partie, dans l'ordre de leur inscription.
 */
function buildDrawInput(
  timeSlotId: string,
  { signUps, signUpCollaborators, catalogue }: DrawCollaborators,
): DrawInput {
  const games = signUpCollaborators.schedule.listGamesStartingOnTimeSlot(timeSlotId);
  const gameIds = new Set(games.map((game) => game.id));
  const participantIds = new Set(
    games.flatMap((game) => signUps.listActiveParticipantIdsOfGame(game, signUpCollaborators)),
  );
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
