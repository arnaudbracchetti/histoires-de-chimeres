/**
 * Codes de refus du domaine, avec leurs paramètres. `contract` déclare la même carte, que l'API
 * traduit en messages (ADR 0008) ; `application` vérifie à la compilation qu'elles concordent.
 */
export type RefusalParams = {
  'convention-name-required': Record<string, never>;
  'convention-name-too-long': { max: number };
  /** La convention est terminée : le front office est fermé à tous. */
  'convention-ended': Record<string, never>;
  /** Le code présenté n'est pas le code de présence (ID-2). */
  'presence-code-wrong': Record<string, never>;
  'time-slot-not-found': Record<string, never>;
  'time-slot-end-not-after-start': Record<string, never>;
  /** `rank` : le rang du créneau chevauché. */
  'time-slot-start-overlaps': { rank: number };
  'time-slot-end-overlaps': { rank: number };
  /** `rank` : le rang du créneau ; `availabilities` : le nombre de MJ disponibles dessus. */
  'time-slot-hours-locked': { rank: number; availabilities: number };
  /** `rank` : le rang du créneau ; `games` : le nombre de parties qu'il porte. */
  'time-slot-hours-locked-by-games': { rank: number; games: number };
  /** `rank` : le rang du créneau ; `games` : le nombre de parties qu'il porte. */
  'time-slot-has-games': { rank: number; games: number };
  'table-not-found': Record<string, never>;
  'table-name-required': Record<string, never>;
  'table-name-too-long': { max: number };
  /** `name` : le nom de la table qui le porte déjà, tel qu'il s'affiche. */
  'table-name-taken': { name: string };
  /** `name` : le nom de la table ; `games` : le nombre de parties qu'elle porte. */
  'table-has-games': { name: string; games: number };
  'game-master-not-found': Record<string, never>;
  'participant-not-found': Record<string, never>;
  /** `nickname` : le pseudo du MJ, qui se supprime par sa fiche de MJ (PR-12, ID-10). */
  'participant-is-game-master': { nickname: string };
  'nickname-required': Record<string, never>;
  'nickname-too-long': { max: number };
  /**
   * `nickname` : le pseudo du MJ qui le porte déjà, tel qu'il s'affiche ; `participantId` : son
   * participant, pour le lien vers sa fiche (ID-12).
   */
  'nickname-taken': { nickname: string; participantId: string };
  /**
   * `nickname` : le pseudo du participant qui le porte déjà, tel qu'il s'affiche ;
   * `participantId` : son identifiant, pour le lien vers sa fiche (PR-12, ID-4, ID-12).
   */
  'nickname-taken-by-participant': { nickname: string; participantId: string };
  /** `scenarios` : le nombre de scénarios du MJ. */
  'game-master-has-scenarios': { scenarios: number };
  /** `nickname` : le pseudo du MJ ; `rank` : le rang du créneau. */
  'game-master-unavailable': { nickname: string; rank: number };
  'game-master-busy': { nickname: string; rank: number };
  /** `nickname` : le pseudo du MJ ; `rank` : le rang du créneau où il mène une partie (PR-15). */
  'availability-has-game': { nickname: string; rank: number };
  /** `nickname` : le pseudo du MJ, dont un scénario n'est en réserve sur aucun créneau (PR-6). */
  'game-master-without-availability': { nickname: string };
  'game-master-busy-everywhere': { nickname: string };
  /** `nickname` : le pseudo du MJ, dont un scénario double n'a aucun créneau possible (PR-6). */
  'game-master-without-consecutive-availabilities': { nickname: string };
  /** `table` : le nom de la table ; `rank` : le rang du créneau. */
  'table-taken': { table: string; rank: number };
  /**
   * `rank` : le rang du créneau dont toutes les tables sont prises ; `twoSlot` : le scénario est
   * double, et chaque table est prise sur ce créneau ou sur le suivant (PR-6).
   */
  'no-free-table': { rank: number; twoSlot: boolean };
  /** `rank` : le rang du dernier créneau, où une partie double ne commence pas. */
  'no-next-time-slot': { rank: number };
  /** `rank` : le rang du premier créneau de la partie double qu'un créneau couperait (PR-11). */
  'time-slot-splits-two-slot-game': { rank: number };
  'game-not-found': Record<string, never>;
  /** `rank` : le rang du créneau, dont le tirage est publié : son programme ne change plus (TI-7). */
  'time-slot-published': { rank: number };
  /**
   * `rank` : le rang du premier créneau tiré que le créneau précéderait ; `published` : son tirage
   * est publié, sinon provisoire. Aucun créneau ne se place avant un créneau tiré (PR-11).
   */
  'time-slot-before-draw': { rank: number; published: boolean };
  /**
   * `rank` : le rang du créneau, dont le tirage est lancé ; `published` : il est publié, sinon
   * provisoire. Ses heures ne changent plus, et il ne se supprime pas (PR-10, PR-11).
   */
  'time-slot-locked-by-draw': { rank: number; published: boolean };
  /** `rank` : le rang du créneau, dont le tirage est lancé (IN-2). */
  'sign-ups-closed': { rank: number };
  /** `rank` : le rang du créneau, dont le tirage est déjà lancé. */
  'draw-already-launched': { rank: number };
  /** `rank` : le rang du créneau, dont le tirage est publié : son résultat ne change plus. */
  'draw-published': { rank: number };
  /** `rank` : le rang du créneau, dont le tirage n'est pas lancé. */
  'draw-not-launched': { rank: number };
  /** `rank` : le rang du créneau, dont le tirage n'est pas publié, ou pas lancé (ID-14). */
  'draw-not-published': { rank: number };
  /** `rank` : le rang du créneau, terminé : son tirage est publié et son heure de fin passée. */
  'time-slot-ended': { rank: number };
  /**
   * `nickname` : le pseudo, tel qu'il s'affiche ; `rank` : le rang du créneau. Le retardataire est
   * déjà dans ce tirage, placé ou non (ID-14).
   */
  'latecomer-already-in-draw': { nickname: string; rank: number };
  /** Le retardataire est un MJ qui mène une partie sur ce créneau (ID-14, IN-4). */
  'latecomer-leads-on-time-slot': { nickname: string; rank: number };
  /**
   * Le retardataire joue, sur ce créneau, la partie double où le tirage du créneau précédent l'a
   * placé (ID-14, TI-3).
   */
  'latecomer-plays-two-slot-game': { nickname: string; rank: number };
  /**
   * `rank` : le rang du créneau ; `previousRank` : celui du premier créneau d'avant dont le tirage
   * n'est pas publié. Les tirages se lancent dans l'ordre de la journée.
   */
  'previous-draw-not-published': { rank: number; previousRank: number };
  'game-already-cancelled': Record<string, never>;
  /**
   * `players` : les joueurs actuels de la partie ; `min` : les places minimum de son scénario,
   * qu'elle atteint : elle se joue (TI-6).
   */
  'game-not-below-minimum': { players: number; min: number };
  'game-not-cancelled': Record<string, never>;
  /** `nickname` : le pseudo du participant, tel qu'il s'affiche ; `rank` : le rang du créneau. */
  'participant-not-in-draw': { nickname: string; rank: number };
  /** `rank` : le rang du créneau du tirage, où la partie ne commence pas. */
  'game-not-on-time-slot': { rank: number };
  'game-cancelled': Record<string, never>;
  /**
   * `rank` : le rang du créneau ; `games` : le nombre de ses parties non annulées sans joueur. Le
   * tirage ne se publie pas : aucun MJ ne reste seul à sa table (TI-7).
   */
  'games-without-players': { rank: number; games: number };
  /** Un MJ ne s'inscrit pas à sa propre partie (IN-4). */
  'game-led-by-participant': Record<string, never>;
  /** Une partie ne s'échange pas avec elle-même (PR-17). */
  'game-swapped-with-itself': Record<string, never>;
  'scenario-not-found': Record<string, never>;
  /** Le scénario a des parties : sa durée ne change plus (PR-14). */
  'scenario-duration-locked': Record<string, never>;
  'scenario-has-games': Record<string, never>;
  'scenario-title-required': Record<string, never>;
  'scenario-title-too-long': { max: number };
  'system-required': Record<string, never>;
  'system-too-long': { max: number };
  'presentation-required': Record<string, never>;
  'presentation-too-long': { max: number };
  'content-warnings-too-long': { max: number };
  'seats-min-below-one': Record<string, never>;
  /** Le maximum est sous le minimum. */
  'seats-out-of-order': Record<string, never>;
};

export type RefusalCode = keyof RefusalParams;

/** Refus d'une règle du domaine : un code et des paramètres, sans texte. */
export class Refusal<C extends RefusalCode = RefusalCode> extends Error {
  constructor(
    readonly code: C,
    readonly params: RefusalParams[C],
  ) {
    super(code);
    this.name = 'Refusal';
  }
}
