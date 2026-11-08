import { endpoint } from './endpoint.js';
import type { TimeSlotStateDto } from './front-office.js';

/**
 * Ses inscriptions sur un créneau, avec le rang du créneau (« Créneau 2 », PR-8) et son état à cet
 * instant, terminé compris : le front ne le recalcule pas.
 */
export type TimeSlotSignUpCountDto = {
  timeSlotId: string;
  rank: number;
  state: TimeSlotStateDto;
  count: number;
};

/** Un pseudo, de participant ou de MJ, dans la liste « Participants » (ID-5). */
export type ParticipantListEntryDto = {
  id: string;
  /** Le pseudo tel qu'il a été saisi (ID-7). */
  nickname: string;
  /** Le pseudo est celui d'un MJ (ADR 0012). */
  gameMaster: boolean;
  /**
   * Ses inscriptions par créneau, un par créneau, dans l'ordre de la journée : aux parties qui y
   * commencent, de secours comprises (IN-4). Une partie double ne compte que sur son premier créneau.
   */
  signUpCounts: TimeSlotSignUpCountDto[];
  /** Le nombre de téléphones reliés au pseudo (ID-8). */
  linkedPhoneCount: number;
  /**
   * Le titre de la partie par laquelle la recherche l'a trouvé, la première de ses inscriptions dont
   * le titre la contient ; `null` sans recherche, ou quand son pseudo la contient.
   */
  matchedGameTitle: string | null;
};

/**
 * La recherche : une partie du pseudo (selon ID-7), ou du titre d'une partie où il est inscrit,
 * à la casse, aux accents et aux espaces près. Vide ou absente, tous les pseudos.
 */
export type ParticipantListQuery = { search?: string };

/**
 * Les pseudos, de participant et de MJ, gérés par un Organisateur (ID-5). La liste les rend dans
 * l'ordre naturel : le front garde cet ordre.
 */
export const participantEndpoints = {
  list: endpoint<ParticipantListEntryDto[], never, never, ParticipantListQuery>(
    'GET',
    'participants',
  ),
};
