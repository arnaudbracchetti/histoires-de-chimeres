/**
 * Inscription : un participant se déclare intéressé par une partie (IN-2). Elle ne garantit pas de
 * jouer. Value object de l'agrégat Convention, qui en garde les règles.
 */
export class SignUp {
  constructor(
    readonly participantId: string,
    readonly gameId: string,
  ) {}

  equals(other: SignUp): boolean {
    return this.participantId === other.participantId && this.gameId === other.gameId;
  }
}
