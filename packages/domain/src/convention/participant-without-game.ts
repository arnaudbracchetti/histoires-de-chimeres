/**
 * Participant sans partie : il reste dans le tirage d'un créneau sans aucune inscription active sur
 * ce créneau, après qu'un geste d'Organisateur lui a retiré la dernière (IN-6). Value object de
 * l'agrégat Convention, rangé dans les Inscriptions, qui en gardent les règles.
 */
export class ParticipantWithoutGame {
  constructor(
    readonly participantId: string,
    readonly timeSlotId: string,
  ) {}

  equals(other: ParticipantWithoutGame): boolean {
    return this.participantId === other.participantId && this.timeSlotId === other.timeSlotId;
  }
}
