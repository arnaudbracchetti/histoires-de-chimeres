/** Une partie du créneau tiré, avec ses places, MJ non compris. */
export type DrawGame = { id: string; minSeats: number; maxSeats: number };

/**
 * Un participant du tirage, avec les parties de l'entrée où son inscription est active (aucune pour
 * un participant sans partie).
 */
export type DrawParticipant = { id: string; gameIds: readonly string[] };

/**
 * Ce que voit l'algorithme : les parties qui commencent sur le créneau, sans les parties annulées,
 * et les participants du tirage. Que des identifiants, sans pseudo ni heure d'inscription : rien
 * d'autre ne peut peser (ADR 0014).
 */
export type DrawInput = { games: readonly DrawGame[]; participants: readonly DrawParticipant[] };

/** Pour chaque participant de l'entrée, sa partie, ou `null` s'il n'est pas placé. */
export type DrawOutput = readonly { participantId: string; gameId: string | null }[];

/** La source de hasard : un nombre de [0, 1), comme `Math.random`. */
export type RandomSource = () => number;

/**
 * Algorithme de tirage (TI-4, ADR 0014) : il répartit les participants d'un créneau sur ses
 * parties. Il est remplaçable ; tout algorithme passe la suite de tests de contrat de
 * `@chimeres/draw/contract-suite`.
 */
export interface DrawAlgorithm {
  computeAssignments(input: DrawInput, random: RandomSource): DrawOutput;
}
