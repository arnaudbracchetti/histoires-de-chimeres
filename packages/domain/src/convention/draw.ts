/**
 * Affectation : le résultat du tirage pour un participant, provisoire ou publié. Sa partie, ou
 * `null` s'il n'est pas placé, et s'il a été déplacé à la main. Value object de l'agrégat
 * Convention, rangé dans les Tirages.
 */
export class Assignment {
  constructor(
    readonly participantId: string,
    readonly gameId: string | null,
    readonly movedByHand: boolean,
  ) {}
}

/**
 * Tirage d'un créneau, lancé : provisoire jusqu'à sa publication. Une affectation par participant
 * du tirage, enregistrés au lancement. Entité de l'agrégat Convention, rangée dans les Tirages, qui
 * en gardent les règles.
 */
export class Draw {
  constructor(
    readonly timeSlotId: string,
    readonly published: boolean,
    readonly assignments: readonly Assignment[],
  ) {}

  /** Le même tirage, sans l'affectation du participant, qui disparaît (PR-12). */
  getDrawAfterRemovingParticipant(participantId: string): Draw {
    return new Draw(
      this.timeSlotId,
      this.published,
      this.assignments.filter((assignment) => assignment.participantId !== participantId),
    );
  }
}
