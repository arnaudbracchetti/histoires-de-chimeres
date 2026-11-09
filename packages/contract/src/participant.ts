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
 * Le résultat d'un pseudo sur un créneau (ID-5), tirage provisoire compris : placé à une table,
 * dans une partie double qui s'y poursuit comprise (`assigned`) ; non placé, avec les tables où il
 * reste de la place, dans l'ordre naturel (`unassigned`) ; MJ de la partie qu'il y mène
 * (`leading`) ; absent d'un tirage lancé (`not-in-draw`) ; inscriptions ouvertes, le nombre de ses
 * inscriptions aux parties qui y commencent, de secours comprises (`signed-up`).
 */
export type ParticipantResultDto =
  | { kind: 'assigned'; tableName: string; title: string; gameMasterNickname: string }
  | { kind: 'unassigned'; tablesWithSeats: { tableName: string; freeSeatCount: number }[] }
  | { kind: 'leading'; title: string; tableName: string }
  | { kind: 'not-in-draw' }
  | { kind: 'signed-up'; signUpCount: number };

/** Le résultat d'un pseudo sur un créneau, avec le rang du créneau et son état à cet instant. */
export type ParticipantTimeSlotDto = {
  timeSlotId: string;
  rank: number;
  state: TimeSlotStateDto;
  result: ParticipantResultDto;
};

/** Un téléphone relié au pseudo : l'heure de sa liaison, rien sur l'appareil (ID-8). */
export type ParticipantLinkedPhoneDto = {
  /** Un instant ISO 8601. */
  linkedAt: string;
};

/** La fiche d'un pseudo, de participant ou de MJ (ID-5). */
export type ParticipantSheetDto = {
  id: string;
  /** Le pseudo tel qu'il a été saisi (ID-7). */
  nickname: string;
  gameMaster: boolean;
  /** Un par créneau, dans l'ordre de la journée. */
  timeSlots: ParticipantTimeSlotDto[];
  /** Dans l'ordre de leur liaison. */
  linkedPhones: ParticipantLinkedPhoneDto[];
};

/** Le pseudo d'un participant. Corps de la création par un Organisateur (ID-12). */
export type ParticipantNicknameBody = {
  nickname: string;
};

/**
 * Les pseudos, de participant et de MJ, gérés par un Organisateur (ID-5). La liste les rend dans
 * l'ordre naturel : le front garde cet ordre. `read` : la fiche d'un pseudo, ou 404. `add` crée un
 * pseudo de participant (ID-12) et rend sa fiche.
 */
export const participantEndpoints = {
  list: endpoint<ParticipantListEntryDto[], never, never, ParticipantListQuery>(
    'GET',
    'participants',
  ),
  read: endpoint<ParticipantSheetDto, { participantId: string }>(
    'GET',
    'participants/:participantId',
  ),
  add: endpoint<ParticipantSheetDto, never, ParticipantNicknameBody>('POST', 'participants'),
};
