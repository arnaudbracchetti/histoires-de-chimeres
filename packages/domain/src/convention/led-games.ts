import type { Game } from './game.js';

/**
 * Les parties que mène chaque participant, par son rôle de MJ (ADR 0012). La convention les tire
 * de son Programme, sans les parties annulées par un tirage, ou avec elles, selon la règle.
 */
export class LedGames {
  private constructor(
    private readonly listGamesOfParticipant: (participantId: string) => readonly Game[],
  ) {}

  /** Les parties menées, que donne `listGamesOfParticipant` pour chaque participant. */
  static createFromLister(
    listGamesOfParticipant: (participantId: string) => readonly Game[],
  ): LedGames {
    return new LedGames(listGamesOfParticipant);
  }

  listGamesLedByParticipant(participantId: string): readonly Game[] {
    return this.listGamesOfParticipant(participantId);
  }

  /** Le MJ du participant mène une partie sur le créneau, partie double comprise (IN-4). */
  isParticipantLeadingOnTimeSlot(participantId: string, timeSlotId: string): boolean {
    return this.listGamesOfParticipant(participantId).some((game) => game.isOnTimeSlot(timeSlotId));
  }

  /** Le MJ du participant mène cette partie (IN-4). */
  isGameLedByParticipant(gameId: string, participantId: string): boolean {
    return this.listGamesOfParticipant(participantId).some((game) => game.id === gameId);
  }
}
