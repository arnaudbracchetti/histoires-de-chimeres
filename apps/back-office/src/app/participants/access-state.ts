import type { AccessStateDto, LocalMomentDto, ParticipantAccountDto } from '@chimeres/contract';
import { formatLocalMoment, fr } from '@chimeres/design';

/** Le bandeau de l'état d'un compte, sur l'onglet « Compte » (ID-16). */
export type AccessStateBanner = {
  label: string;
  help: string;
  icon: string;
  /** La couleur de statut de la charte (docs/design/jetons.md). */
  color: string;
  /** Le libellé du bouton qui crée un lien d'accès. */
  action: string;
};

type StateDescription = Omit<AccessStateBanner, 'label'> & {
  /** Le libellé, avec la fin du lien pour un lien en attente ou expiré. */
  describe: (expiresAt: LocalMomentDto | null) => string;
};

/** « jusqu'au dimanche 21 mars à 9 h 30 », ou rien si l'API ne donne pas la date. */
const dateOf = (expiresAt: LocalMomentDto | null) =>
  expiresAt ? formatLocalMoment(expiresAt) : '';

const STATES: Record<AccessStateDto, StateDescription> = {
  active: {
    describe: () => 'Compte actif',
    help: fr`Le mot de passe est choisi : la personne se connecte seule.`,
    icon: 'circle-check',
    color: 'var(--success)',
    action: 'Créer un nouveau lien',
  },
  pending: {
    describe: (expiresAt) => fr`En attente · lien valable jusqu'au ${dateOf(expiresAt)}`,
    help: fr`Le lien d'accès est créé, la personne ne l'a pas encore suivi.`,
    icon: 'hourglass',
    color: 'var(--accent)',
    action: 'Créer un nouveau lien',
  },
  'no-link': {
    describe: () => 'Lien à créer',
    help: fr`Le compte existe, mais aucun lien d'accès n'a été remis.`,
    icon: 'triangle-alert',
    color: 'var(--warning)',
    action: "Créer le lien d'accès",
  },
  expired: {
    describe: (expiresAt) => fr`Lien expiré le ${dateOf(expiresAt)}`,
    help: fr`Le lien n'a pas été suivi à temps : crée-en un nouveau.`,
    icon: 'octagon-alert',
    color: 'var(--danger)',
    action: 'Créer un nouveau lien',
  },
};

/**
 * « Compte actif » en vert, « En attente · lien valable jusqu'au dimanche 21 mars à 9 h 30 » en
 * orange, « Lien à créer » en jaune, « Lien expiré le … » en rouge brique.
 */
export function describeAccessState(account: ParticipantAccountDto): AccessStateBanner {
  const { describe, ...rest } = STATES[account.state];
  return { ...rest, label: describe(account.accessLinkExpiresAt) };
}
