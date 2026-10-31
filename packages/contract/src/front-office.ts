import { endpoint } from './endpoint.js';
import type { SeatsDto } from './scenario.js';

/** Paramètre de l'adresse du QR code de l'affiche, qui porte le code de présence : `/?code=K7M2`. */
export const PRESENCE_CODE_PARAM = 'code';

/** Ce que le front office lit à son ouverture, tant que la convention n'est pas terminée. */
export type FrontOfficeDto = {
  conventionName: string;
};

export type PresenceCodeBody = {
  /** Le code tapé, à la casse et aux espaces du début et de la fin près. */
  presenceCode: string;
};

/** Un créneau du programme du front office. */
export type FrontOfficeTimeSlotDto = {
  id: string;
  /** Rang dans la journée, à partir de 1 : « Créneau 2 » (PR-8). */
  rank: number;
  /** `HH:MM`, à l'heure de Paris. */
  start: string;
  /** `HH:MM`, après le début, le même jour. */
  end: string;
};

/** Une partie du programme du front office, avec tout le contenu de sa fiche (§5.3, ADR 0011). */
export type FrontOfficeGameDto = {
  id: string;
  /** Ses créneaux, dans l'ordre de la journée : deux pour une partie double. */
  timeSlotIds: string[];
  tableName: string;
  title: string;
  system: string;
  gameMasterNickname: string;
  /** URL de l'image, ou `null` : le front dessine alors l'illustration par défaut (PR-7). */
  imageUrl: string | null;
  /** En Markdown restreint : paragraphes, gras, italique et listes. */
  presentation: string;
  /** Vide sans avertissement. */
  contentWarnings: string;
  /** Ses places : celles de son scénario (PR-4). */
  seats: SeatsDto;
  /** Le nombre d'inscrits. */
  signUpCount: number;
  /**
   * Le nombre de joueurs, une fois le tirage de son créneau publié : il reste de la place sous ses
   * places maximum. `null` avant.
   */
  playerCount: number | null;
  /** Partie très demandée : ses inscrits dépassent ses places maximum (IN-5). */
  oversubscribed: boolean;
};

/**
 * Le programme, tel que le lit le téléphone : de quoi le garder lisible hors ligne, et cacher
 * lui-même les créneaux terminés, selon son heure (ADR 0011).
 */
export type FrontOfficeScheduleDto = {
  /** Date de la convention, `AAAA-MM-JJ`, ou `null` tant qu'elle n'est pas fixée : aucun créneau ne se termine. */
  date: string | null;
  /** Dans l'ordre de la journée. */
  timeSlots: FrontOfficeTimeSlotDto[];
  /** Dans l'ordre naturel de leur table. */
  games: FrontOfficeGameDto[];
  /**
   * La fin de la convention : la fin de son dernier créneau (`HH:MM`), le jour de sa date. `null`
   * sans date ou sans créneau.
   */
  end: { date: string; time: string } | null;
};

/**
 * L'état d'un créneau : inscriptions ouvertes, tirage lancé (inscriptions fermées), ou tirage
 * publié (résultat figé).
 */
export type TimeSlotStateDto = 'sign-ups-open' | 'drawing' | 'published';

/**
 * Le résultat publié du tirage d'un créneau pour le pseudo : sa partie, ou pas de place. Pour un MJ,
 * sur le créneau où commence sa partie : ses joueurs, dans l'ordre naturel de leur pseudo
 * (`leading`), ou sa partie annulée (`cancelled`, TI-6). `null` tant que le tirage n'est pas publié,
 * ou sans inscription.
 */
export type DrawResultDto =
  | { kind: 'assigned'; gameId: string }
  | { kind: 'unassigned' }
  | { kind: 'leading'; players: string[] }
  | { kind: 'cancelled' }
  | null;

/** La situation du pseudo du téléphone : ses inscriptions, et l'état de chaque créneau pour lui, MJ compris. */
export type ParticipantSituationDto = {
  /** Les parties où il est inscrit. */
  signedUpGameIds: string[];
  /** Dans l'ordre de la journée. */
  timeSlots: {
    timeSlotId: string;
    state: TimeSlotStateDto;
    /**
     * La partie que mène son MJ sur ce créneau, sur les deux d'une partie double, ou `null` : il ne
     * peut pas s'y inscrire (IN-4).
     */
    ledGameId: string | null;
    drawResult: DrawResultDto;
  }[];
};

/** Le front office se ferme à la fin de la convention : ses endpoints refusent alors avec `convention-ended`. */
export const frontOfficeEndpoints = {
  read: endpoint<FrontOfficeDto>('GET', 'front-office'),
  /** Vérifie le code de présence, sans rien changer : 204, ou `presence-code-wrong` (ID-2). */
  verifyPresenceCode: endpoint<void, never, PresenceCodeBody>('POST', 'front-office/presence-code'),
  /** Le programme, servi au seul téléphone relié : sinon `phone-not-linked`. */
  readSchedule: endpoint<FrontOfficeScheduleDto>('GET', 'front-office/schedule'),
  /** La situation du pseudo, servie au seul téléphone relié : sinon `phone-not-linked`. */
  readSituation: endpoint<ParticipantSituationDto>('GET', 'front-office/situation'),
};

/**
 * L'inscription du pseudo du téléphone relié à une partie (IN-2) : une ressource, posée par
 * `signUp` et retirée par `withdraw`, sans effet si on les répète. 204, ou `phone-not-linked`.
 */
export const signUpEndpoints = {
  signUp: endpoint<void, { gameId: string }>('PUT', 'front-office/games/:gameId/sign-up'),
  withdraw: endpoint<void, { gameId: string }>('DELETE', 'front-office/games/:gameId/sign-up'),
};
