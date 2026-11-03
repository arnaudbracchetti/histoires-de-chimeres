import { endpoint } from './endpoint.js';
import type { TimeSlotStateDto } from './front-office.js';
import type { VerdictRefusalDto } from './problem.js';
import type { GameDto, ReserveScenarioDto } from './schedule.js';
import type { TableDto } from './table.js';

/**
 * La capacité d'un créneau : de la somme des places minimum à la somme des places maximum des
 * parties qui y commencent.
 */
export type CapacityDto = { min: number; max: number };

/**
 * Le risque d'un participant du créneau : sans partie (`without-game`) ; ou, quand aucune de ses
 * parties du créneau n'est sûre (inscrits entre ses places minimum et maximum), toutes sont très
 * demandées, il risque de ne pas être placé, sinon il risque de rester sans table.
 */
export type ParticipantRiskDto = 'without-game' | 'may-not-be-placed' | 'may-be-left-without-table';

/**
 * Un participant du créneau : les parties qui y commencent où son inscription est active (IN-4),
 * dans l'ordre de leur programmation, aucune s'il y est sans partie, et son risque, ou `null` (jamais sur un créneau sans
 * inscription, ou fermé).
 */
export type TrackedParticipantDto = {
  id: string;
  nickname: string;
  gameIds: string[];
  risk: ParticipantRiskDto | null;
};

/**
 * Un scénario de la réserve du créneau : son MJ y est disponible, et il n'a aucune partie qui y
 * commence. `refusal` est `null` s'il y est programmable (une table au moins le permet, PR-5),
 * sinon son motif : le premier refus de ses cases qui n'est pas « table prise », ou
 * `no-free-table`.
 */
export type TimeSlotReserveEntryDto = { scenarioId: string; refusal: VerdictRefusalDto | null };

/**
 * Paramètres de la ligne de sous-demande : `demand` et `minCapacity`, le nombre de parties sous
 * leur minimum, et celui des participants qui risquent de rester sans table.
 */
type UnderDemandParams = {
  demand: number;
  minCapacity: number;
  gamesBelowMinimum: number;
  participantsMayBeLeftWithoutTable: number;
};

/**
 * Codes des avertissements de suivi d'un créneau, avec leurs paramètres (ADR 0008). Le domaine
 * déclare la même carte, et `application` vérifie à la compilation qu'elles concordent.
 */
export type SignUpWarningParams = {
  /** La demande dépasse la capacité maximum : `missingSeats` places manquent. */
  'seats-missing': { demand: number; maxCapacity: number; missingSeats: number };
  /** `participantCount` participants sont sans partie sur le créneau. */
  'participants-without-game': { participantCount: number };
  /** `participantCount` participants risquent de ne pas être placés : toutes leurs parties du créneau sont très demandées. */
  'participants-may-not-be-placed': { participantCount: number };
  /** La demande atteint 80 % de la capacité maximum, sans la dépasser. */
  'nearly-full': { demand: number; maxCapacity: number };
  /** La demande est sous la capacité minimum. */
  'too-many-games': UnderDemandParams;
  /** Sinon, une partie au moins est sous son minimum. */
  'games-below-minimum': UnderDemandParams;
};

export type SignUpWarningCode = keyof SignUpWarningParams;

/** Rouge (`danger`) ou jaune (`warning`), comme les statuts de la charte. */
export type SignUpWarningLevel = 'danger' | 'warning';

/**
 * Un avertissement de suivi d'un créneau, écrit par l'API : le titre (« Il manque 4 places ») et
 * le détail (« 26 participants pour 22 places au plus. »). Le front ne lit le code que pour choisir
 * son bouton.
 */
export type SignUpWarningDto = {
  code: SignUpWarningCode;
  level: SignUpWarningLevel;
  title: string;
  detail: string;
};

/**
 * Le suivi des inscriptions d'un créneau. `demand` : les participants distincts qui ont au moins
 * une inscription active sur une partie qui y commence (IN-4), ou qui y sont sans partie. Une partie double ne compte que sur
 * son premier créneau.
 */
export type TimeSlotTrackingDto = {
  id: string;
  /** Rang dans la journée, à partir de 1 : « Créneau 2 » (PR-8). */
  rank: number;
  /** `HH:MM`. */
  start: string;
  /** `HH:MM`. */
  end: string;
  state: TimeSlotStateDto;
  demand: number;
  capacity: CapacityDto;
  /**
   * Ceux qui sont sans partie sur le créneau d'abord, puis ceux qui n'y ont qu'une inscription,
   * puis les autres, chaque groupe dans l'ordre naturel des pseudos : le front garde cet ordre. Le MJ qui mène sur le créneau n'y est
   * pas (IN-4).
   */
  participants: TrackedParticipantDto[];
  /**
   * Trois au plus, les rouges d'abord : le front garde cet ordre, et leur nombre est celui de la
   * tuile. Aucun sur un créneau sans inscription, ou fermé.
   */
  warnings: SignUpWarningDto[];
  /**
   * Les programmables d'abord, puis les autres, chaque groupe dans l'ordre naturel des titres : le
   * front garde cet ordre. Vide sur un créneau fermé.
   */
  reserve: TimeSlotReserveEntryDto[];
  /** Le tirage du créneau, `null` tant qu'il n'est pas lancé. */
  draw: DrawTrackingDto | null;
};

/**
 * Le tirage d'une partie qui commence sur le créneau : ses joueurs, « sous son minimum » (1 joueur
 * au moins, sous ses places minimum), « sans joueur », « au-delà de son maximum », et son écart :
 * les places libres sous son maximum (`freeSeatCount`), ou les joueurs de trop au-delà
 * (`surplusPlayerCount`).
 */
export type DrawGameDto = {
  gameId: string;
  playerCount: number;
  belowMinimum: boolean;
  withoutPlayers: boolean;
  overMaximum: boolean;
  freeSeatCount: number;
  surplusPlayerCount: number;
};

/**
 * Une affectation du tirage : la partie du participant, ou `null` s'il n'est pas placé ; déplacé à
 * la main ; les parties du créneau où son inscription est active (IN-4) ; et s'il joue à une partie
 * qui n'est pas de ses inscriptions.
 */
export type AssignmentDto = {
  participantId: string;
  nickname: string;
  gameId: string | null;
  movedByHand: boolean;
  signedUpGameIds: string[];
  playsWithoutSignUp: boolean;
};

/** Une table où il reste de la place, avec son nom et ses places libres. */
export type TableWithSeatsDto = { tableId: string; name: string; freeSeatCount: number };

/**
 * Le tirage d'un créneau lancé, provisoire ou publié : ses chiffres (participants du tirage,
 * placés, non placés, parties qui commencent sur le créneau, parties à leur minimum, places libres),
 * les tables où il reste de la place, dans l'ordre naturel, ses parties, dans l'ordre de leur
 * programmation, et ses affectations, dans l'ordre naturel des pseudos : le front garde ces ordres.
 */
export type DrawTrackingDto = {
  published: boolean;
  participantCount: number;
  assignedCount: number;
  unassignedCount: number;
  gameCount: number;
  gamesAtMinimumCount: number;
  freeSeatCount: number;
  tablesWithSeats: TableWithSeatsDto[];
  games: DrawGameDto[];
  assignments: AssignmentDto[];
};

/**
 * Une partie, comme dans le programme, avec son suivi sur son premier créneau : ses inscrits actifs
 * (IN-4), combien n'ont pas d'autre inscription active sur le créneau, « très demandée » (inscrits >
 * places maximum) et « sous son minimum » (inscrits < places minimum, jamais sur un créneau sans
 * inscription). `surplusSignUpCount` : les inscrits de trop au-delà du maximum ;
 * `missingSignUpCount` : ceux qui manquent pour le minimum, 0 quand elle n'est pas sous son minimum.
 */
export type TrackedGameDto = GameDto & {
  signUpCount: number;
  withoutOtherSignUpCount: number;
  oversubscribed: boolean;
  belowMinimum: boolean;
  surplusSignUpCount: number;
  missingSignUpCount: number;
};

/**
 * Le suivi des inscriptions : les créneaux, dans l'ordre de la journée, les tables, dans l'ordre
 * naturel, les parties, dans l'ordre de leur programmation, et la réserve, comme dans le programme.
 */
export type SignUpTrackingDto = {
  timeSlots: TimeSlotTrackingDto[];
  tables: TableDto[];
  games: TrackedGameDto[];
  reserve: ReserveScenarioDto[];
};

/** La page « Pilotage du jour J » lit tout ce qu'elle montre en une seule lecture. */
export const signUpTrackingEndpoints = {
  read: endpoint<SignUpTrackingDto>('GET', 'sign-up-tracking'),
};
