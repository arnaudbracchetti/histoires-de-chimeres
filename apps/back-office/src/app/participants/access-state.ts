import type { AccessStateDto, LocalMomentDto, ParticipantAccountDto } from '@chimeres/contract';
import { countOf, formatLocalMoment, fr, NBSP } from '@chimeres/design';

/**
 * Le bandeau de l'état d'un compte, sur l'onglet « Compte » (ID-16). Sa couleur de statut vient de
 * `styles.css`, par l'attribut `data-access-state` qui porte `state`.
 */
export type AccessStateBanner = {
  state: AccessStateDto;
  label: string;
  help: string;
  icon: string;
  /** Le libellé du bouton qui crée un lien d'accès. */
  action: string;
};

type StateDescription = Omit<AccessStateBanner, 'state' | 'label'> & {
  /** Le libellé court, sans date : celui du filtre de la liste « Participants ». */
  shortLabel: string;
  /**
   * Le libellé avec le temps qui reste au lien en attente, ou sa fin pour un lien expiré ; sinon,
   * le libellé court.
   */
  describeLink?: (account: ParticipantAccountDto) => string;
};

/** « jusqu'au dimanche 21 mars à 9 h 30 », ou rien si l'API ne donne pas la date. */
const dateOf = (expiresAt: LocalMomentDto | null) =>
  expiresAt ? formatLocalMoment(expiresAt) : '';

/** Les états, dans l'ordre des filtres : du compte prêt au lien à refaire. */
const STATES: Record<AccessStateDto, StateDescription> = {
  active: {
    shortLabel: 'Compte actif',
    help: fr`Le mot de passe est choisi : la personne se connecte seule.`,
    icon: 'circle-check',
    action: 'Créer un nouveau lien',
  },
  pending: {
    shortLabel: 'En attente',
    describeLink: ({ accessLinkRemainingMinutes }) =>
      `En attente · ${formatRemainingTime(accessLinkRemainingMinutes ?? 0)}`,
    help: fr`Le lien d'accès est créé, la personne ne l'a pas encore suivi.`,
    icon: 'hourglass',
    action: 'Créer un nouveau lien',
  },
  'no-link': {
    shortLabel: 'Lien à créer',
    help: fr`Le compte existe, mais aucun lien d'accès n'a été remis.`,
    icon: 'triangle-alert',
    action: "Créer le lien d'accès",
  },
  expired: {
    shortLabel: 'Lien expiré',
    describeLink: ({ accessLinkExpiresAt }) => fr`Lien expiré le ${dateOf(accessLinkExpiresAt)}`,
    help: fr`Le lien n'a pas été suivi à temps : crée-en un nouveau.`,
    icon: 'octagon-alert',
    action: 'Créer un nouveau lien',
  },
};

/**
 * « Compte actif », « En attente · encore 5 jours », « Lien à créer », « Lien expiré le dimanche
 * 21 mars à 9 h 30 ».
 */
export function describeAccessState(account: ParticipantAccountDto): AccessStateBanner {
  const { shortLabel, describeLink, ...rest } = STATES[account.state];
  return {
    ...rest,
    state: account.state,
    label: describeLink ? describeLink(account) : shortLabel,
  };
}

/**
 * « encore 5 jours », en jours entiers ; le dernier jour, « encore 3 h » ; la dernière heure,
 * « encore moins d'une heure ».
 */
function formatRemainingTime(minutes: number): string {
  const days = Math.floor(minutes / (24 * 60));
  if (days > 0) return `encore ${countOf(days, 'jour', 'jours')}`;
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `encore ${hours}${NBSP}h` : "encore moins d'une heure";
}

/** Un filtre par état de la liste « Participants » : son libellé court (ID-16). */
export type AccessStateFilter = { state: AccessStateDto; label: string };

/** Les filtres par état, du compte prêt au lien à refaire. */
export const ACCESS_STATE_FILTERS: AccessStateFilter[] = (
  Object.entries(STATES) as [AccessStateDto, StateDescription][]
).map(([state, { shortLabel }]) => ({ state, label: shortLabel }));
