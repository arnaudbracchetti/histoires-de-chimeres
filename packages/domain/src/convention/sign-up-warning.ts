import type { Capacity } from './sign-up-tracking.js';

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
 * Codes des avertissements de suivi d'un créneau, avec leurs paramètres. `contract` déclare la même
 * carte, que l'API traduit en titre et en détail (ADR 0008) ; `application` vérifie à la
 * compilation qu'elles concordent.
 */
export type SignUpWarningParams = {
  /** La demande dépasse la capacité maximum : `missingSeats` places manquent. */
  'seats-missing': { demand: number; maxCapacity: number; missingSeats: number };
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

/** Un avertissement de suivi : un code, son niveau et ses paramètres, sans texte. */
export type SignUpWarning = {
  [C in SignUpWarningCode]: { code: C; level: SignUpWarningLevel; params: SignUpWarningParams[C] };
}[SignUpWarningCode];

/** Le seuil de « presque plein », en pourcentage de la capacité maximum. Sans réglage. */
const NEARLY_FULL_PERCENT = 80;

/** Ce que les avertissements de suivi lisent du suivi d'un créneau. */
export type SignUpWarningFigures = {
  demand: number;
  capacity: Capacity;
  gamesBelowMinimum: number;
  participantsMayNotBePlaced: number;
  participantsMayBeLeftWithoutTable: number;
};

/**
 * Les avertissements de suivi d'un créneau ouvert qui a des inscriptions, trois au plus : les rouges
 * d'abord, puis la ligne des places (`seats-missing` ou `nearly-full`), puis la ligne de
 * sous-demande (`too-many-games` ou `games-below-minimum`).
 */
export function computeSignUpWarnings(figures: SignUpWarningFigures): SignUpWarning[] {
  const { demand, capacity } = figures;
  const warnings: SignUpWarning[] = [];
  if (demand > capacity.max) {
    warnings.push({
      code: 'seats-missing',
      level: 'danger',
      params: { demand, maxCapacity: capacity.max, missingSeats: demand - capacity.max },
    });
  }
  if (figures.participantsMayNotBePlaced > 0) {
    warnings.push({
      code: 'participants-may-not-be-placed',
      level: 'danger',
      params: { participantCount: figures.participantsMayNotBePlaced },
    });
  }
  if (demand <= capacity.max && demand * 100 >= capacity.max * NEARLY_FULL_PERCENT) {
    warnings.push({
      code: 'nearly-full',
      level: 'warning',
      params: { demand, maxCapacity: capacity.max },
    });
  }
  const underDemand: UnderDemandParams = {
    demand,
    minCapacity: capacity.min,
    gamesBelowMinimum: figures.gamesBelowMinimum,
    participantsMayBeLeftWithoutTable: figures.participantsMayBeLeftWithoutTable,
  };
  if (demand < capacity.min) {
    warnings.push({ code: 'too-many-games', level: 'warning', params: underDemand });
  } else if (figures.gamesBelowMinimum > 0) {
    warnings.push({ code: 'games-below-minimum', level: 'warning', params: underDemand });
  }
  return warnings;
}
