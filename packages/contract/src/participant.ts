import type { LocalMomentDto } from './account.js';
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
  /** Son compte a le rôle Organisateur (ID-16). */
  organizer: boolean;
  /** Son compte du back office, ou `null` s'il n'en a pas (ID-16). */
  account: ParticipantAccountDto | null;
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

/**
 * Le résultat d'un pseudo sur un créneau, avec le rang du créneau et son état à cet instant. Puis
 * la partie qu'il y mène, sur ses deux créneaux pour une partie double, ou `null` : là où il mène,
 * ses inscriptions sont de secours (IN-4). Puis s'il y est sans partie (IN-6). Enfin, si on peut
 * l'ajouter comme non placé au tirage publié du créneau (ID-14) : `addLatecomer` ne le refuserait
 * pas à cet instant ; le front n'en déduit rien d'autre.
 */
export type ParticipantTimeSlotDto = {
  timeSlotId: string;
  rank: number;
  state: TimeSlotStateDto;
  result: ParticipantResultDto;
  ledGameId: string | null;
  withoutGame: boolean;
  latecomerAdditionAllowed: boolean;
};

/** Un téléphone relié au pseudo : l'heure de sa liaison, rien sur l'appareil (ID-8). */
export type ParticipantLinkedPhoneDto = {
  /** Un instant ISO 8601. */
  linkedAt: string;
};

/** Un rôle du back office (ID-16) : Organisateur, porté par le compte, ou MJ, porté par le participant. */
export type AccountRole = 'organizer' | 'game-master';

/**
 * L'état d'un compte (ID-16) : mot de passe choisi (`active`), lien d'accès en cours (`pending`),
 * lien expiré sans mot de passe (`expired`), ni l'un ni l'autre (`no-link`).
 */
export type AccessStateDto = 'active' | 'pending' | 'expired' | 'no-link';

/** Le compte d'un pseudo, sur sa fiche (ID-16). */
export type ParticipantAccountDto = {
  /** Son seul rôle, dont le retrait supprimerait le compte, ou `null` s'il en a deux. */
  onlyRole: AccountRole | null;
  state: AccessStateDto;
  /** La fin de validité du lien d'accès, en cours ou expiré, ou `null` sans lien à suivre. */
  accessLinkExpiresAt: LocalMomentDto | null;
  /**
   * Le temps qui reste au lien en attente, en minutes, au moment de la lecture, ou `null` hors
   * attente.
   */
  accessLinkRemainingMinutes: number | null;
};

/** La fiche d'un pseudo, de participant ou de MJ (ID-5). */
export type ParticipantSheetDto = {
  id: string;
  /** Le pseudo tel qu'il a été saisi (ID-7). */
  nickname: string;
  /** Son participant a le rôle MJ (ADR 0012). */
  gameMaster: boolean;
  /** Son compte a le rôle Organisateur (ID-16). */
  organizer: boolean;
  /** Son compte du back office, ou `null` s'il n'en a pas (ID-16). */
  account: ParticipantAccountDto | null;
  /** Les parties où son inscription est active (IN-4). */
  signedUpGameIds: string[];
  /** Ses inscriptions de secours, sur les créneaux où il mène (IN-4). */
  backupGameIds: string[];
  /** Un par créneau, dans l'ordre de la journée. */
  timeSlots: ParticipantTimeSlotDto[];
  /** Dans l'ordre de leur liaison. */
  linkedPhones: ParticipantLinkedPhoneDto[];
};

/** Le pseudo d'un participant. Corps de la création (ID-12) et du renommage (ID-13). */
export type ParticipantNicknameBody = {
  nickname: string;
};

/** Le sort d'un élément du pseudo fusionné (ID-11) : passé à la destination, ou perdu. */
export type MergeOutcomeDto = 'transferred' | 'lost';

/**
 * Ce que la fusion d'un pseudo fera sur un créneau (ID-11), avec le rang du créneau.
 * `assignment` : l'affectation de la source dans son tirage, sa partie et sa table (`null` non
 * placée), passée à la destination ou perdue ; `null` si la source n'y est pas.
 * `destinationLeavesDraw` : la destination quitte ce tirage, en prenant la partie double de la
 * source (TI-3). Les titres des parties qui commencent sur le créneau où les inscriptions de la
 * source passent, passent en secours, là où la destination mène une autre partie (IN-4), ou se
 * perdent, sans celles que la destination a déjà. `withoutGame` : le sort de l'état sans partie de
 * la source (IN-6), ou `null`.
 */
export type MergeTimeSlotVerdictDto = {
  timeSlotId: string;
  rank: number;
  assignment: { title: string | null; tableName: string | null; outcome: MergeOutcomeDto } | null;
  destinationLeavesDraw: boolean;
  transferredSignUpTitles: string[];
  backupSignUpTitles: string[];
  lostSignUpTitles: string[];
  withoutGame: MergeOutcomeDto | null;
};

/** Ce que la fusion fera : un par créneau, dans l'ordre de la journée. */
export type MergeVerdictDto = { timeSlots: MergeTimeSlotVerdictDto[] };

/** La source (`participantId`) et la destination d'une fusion (ID-11). */
export type MergeParams = { participantId: string; destinationId: string };

/**
 * Les pseudos, de participant et de MJ, gérés par un Organisateur (ID-5). La liste les rend dans
 * l'ordre naturel : le front garde cet ordre. `read` : la fiche d'un pseudo, ou 404. `add` crée un
 * pseudo de participant (ID-12) et rend sa fiche. `rename` renomme un pseudo, de participant ou de
 * MJ (ID-13), et rend sa fiche. `remove` supprime un pseudo de participant, pas de MJ (ID-10,
 * PR-12), et ne rend rien. `signUp`, `withdraw` et `withdrawFromDraw` inscrivent le pseudo
 * à une partie, l'en désinscrivent, ou le retirent du tirage d'un créneau où il est sans partie, à
 * sa place (ID-12), aux règles du téléphone ; répétés, ils ne changent rien. `addLatecomer` ajoute
 * le pseudo au tirage publié d'un créneau, non placé, et le notifie (ID-14). Chacun rend la fiche.
 * `unlinkPhones` coupe tous les liens du pseudo, sans verrou : il peut être relié de nouveau
 * (ID-8). Il rend la fiche. `merge` fusionne le pseudo dans la destination, participant ou MJ, et
 * rend la fiche de la destination ; le pseudo fusionné est supprimé (ID-11). `readMergeVerdict` dit
 * ce que la fusion fera, sans rien changer.
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
  rename: endpoint<ParticipantSheetDto, { participantId: string }, ParticipantNicknameBody>(
    'PUT',
    'participants/:participantId',
  ),
  remove: endpoint<void, { participantId: string }>('DELETE', 'participants/:participantId'),
  signUp: endpoint<ParticipantSheetDto, { participantId: string; gameId: string }>(
    'PUT',
    'participants/:participantId/games/:gameId/sign-up',
  ),
  withdraw: endpoint<ParticipantSheetDto, { participantId: string; gameId: string }>(
    'DELETE',
    'participants/:participantId/games/:gameId/sign-up',
  ),
  withdrawFromDraw: endpoint<ParticipantSheetDto, { participantId: string; timeSlotId: string }>(
    'DELETE',
    'participants/:participantId/time-slots/:timeSlotId/draw-participation',
  ),
  addLatecomer: endpoint<ParticipantSheetDto, { participantId: string; timeSlotId: string }>(
    'PUT',
    'participants/:participantId/time-slots/:timeSlotId/latecomer',
  ),
  merge: endpoint<ParticipantSheetDto, MergeParams>(
    'POST',
    'participants/:participantId/merge/:destinationId',
  ),
  readMergeVerdict: endpoint<MergeVerdictDto, MergeParams>(
    'GET',
    'participants/:participantId/merge-verdict/:destinationId',
  ),
  unlinkPhones: endpoint<ParticipantSheetDto, { participantId: string }>(
    'DELETE',
    'participants/:participantId/linked-phones',
  ),
  /**
   * Les rôles du pseudo (ID-16), donnés ou retirés par un Organisateur ; chacun rend la fiche relue.
   * Donner un premier rôle crée le compte, retirer le dernier le supprime, avec ses sessions. Retirer
   * le rôle MJ est refusé par `game-master-has-scenarios` tant que le MJ a un scénario (PR-12) ; se
   * retirer soi-même le rôle d'Organisateur, par `own-organizer-role-withdrawal`. Donner un rôle déjà
   * là, ou retirer un rôle absent, ne change rien.
   */
  appointOrganizer: endpoint<ParticipantSheetDto, { participantId: string }>(
    'PUT',
    'participants/:participantId/roles/organizer',
  ),
  withdrawOrganizerRole: endpoint<ParticipantSheetDto, { participantId: string }>(
    'DELETE',
    'participants/:participantId/roles/organizer',
  ),
  appointGameMaster: endpoint<ParticipantSheetDto, { participantId: string }>(
    'PUT',
    'participants/:participantId/roles/game-master',
  ),
  withdrawGameMasterRole: endpoint<ParticipantSheetDto, { participantId: string }>(
    'DELETE',
    'participants/:participantId/roles/game-master',
  ),
};
