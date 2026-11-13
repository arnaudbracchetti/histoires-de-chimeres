import { endpoint } from './endpoint.js';

/** Bornes du mot de passe d'un compte (ADR 0018), reprises du domaine. */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export type LogInBody = {
  /** Le pseudo du participant, comparé comme ID-7. */
  nickname: string;
  password: string;
};

export type ChangeOwnPasswordBody = {
  /** Le mot de passe actuel : une session seule ne suffit pas à changer le mot de passe. */
  currentPassword: string;
  /** Le nouveau mot de passe, de 10 à 128 caractères, différent du pseudo (ADR 0018). */
  password: string;
};

/** Le compte de la personne connectée au back office (ADR 0015). */
export type ConnectedAccountDto = {
  /** Son participant : la fiche de son pseudo. */
  participantId: string;
  /** Le pseudo de son participant, tel qu'il s'affiche. */
  nickname: string;
  organizer: boolean;
  /** Son MJ, si son participant en est un (ADR 0012), sinon `null`. */
  gameMasterId: string | null;
};

/** Une fin de validité, à l'heure locale de la convention : `2027-03-21` et `08:30`. */
export type LocalMomentDto = { date: string; time: string };

/** Le lien d'accès qu'un Organisateur vient de créer (ADR 0018) : l'URL n'est donnée qu'une fois. */
export type CreatedAccessLinkDto = {
  /** L'URL complète, jeton compris, à remettre à la personne. */
  url: string;
  expiresAt: LocalMomentDto;
};

/** Ce que la page d'un lien d'accès montre avant que la personne choisisse son mot de passe. */
export type AccessLinkDto = {
  /** Le pseudo du compte, pour que la personne sache quel compte elle reçoit. */
  nickname: string;
};

export type ChooseAccessLinkPasswordBody = {
  /** Le mot de passe choisi, de 10 à 128 caractères, différent du pseudo (ADR 0018). */
  password: string;
};

/**
 * Le lien d'accès d'un compte (ID-6, ADR 0018) : 7 jours, une seule fois. Le jeton vit dans le
 * chemin ; l'API ne le journalise pas. Un jeton inconnu donne `access-link-unknown`, un lien qui a
 * servi `access-link-used`, un lien trop vieux `access-link-expired`.
 */
export const accessLinkEndpoints = {
  /**
   * Créer un lien d'accès pour le compte d'un pseudo : il remplace le précédent, efface le mot de
   * passe et ferme toutes les sessions du compte. Sans compte : `account-not-found`.
   */
  create: endpoint<CreatedAccessLinkDto, { participantId: string }>(
    'POST',
    'participants/:participantId/access-link',
  ),
  /** Lire le pseudo d'un lien d'accès, sans l'utiliser : l'aperçu d'une messagerie ne le consomme pas. */
  read: endpoint<AccessLinkDto, { token: string }>('GET', 'access-links/:token', {
    access: 'public',
  }),
  /** Choisir son mot de passe par le lien, qui ne sert plus : la personne est connectée. */
  choosePassword: endpoint<ConnectedAccountDto, { token: string }, ChooseAccessLinkPasswordBody>(
    'POST',
    'access-links/:token',
    { access: 'public' },
  ),
};

/**
 * Le compte du back office et sa session (ADR 0019). La session tient dans un cookie `HttpOnly`,
 * posé par `logIn` et effacé par `logOut`.
 */
export const accountEndpoints = {
  /** Lire son propre compte : refusé sans session par `not-logged-in`. */
  read: endpoint<ConnectedAccountDto>('GET', 'account', { access: 'gameMaster' }),
  /**
   * Se connecter : un pseudo inconnu et un mauvais mot de passe donnent la même réponse,
   * `wrong-credentials`. Au-delà de la limite des essais : `too-many-login-attempts` (ADR 0018).
   */
  logIn: endpoint<ConnectedAccountDto, never, LogInBody>('POST', 'account/session', {
    access: 'public',
  }),
  /** Se déconnecter : supprime la session en base ; sans effet sans session. */
  logOut: endpoint<void>('DELETE', 'account/session', { access: 'gameMaster' }),
  /**
   * Changer son mot de passe : ferme ses autres sessions, garde celle en cours (ADR 0019). Un mot
   * de passe actuel faux donne `current-password-wrong` ; sans session, `not-logged-in`. Après un
   * oubli, c'est le lien d'accès qui fait choisir un nouveau mot de passe (ADR 0018).
   */
  changePassword: endpoint<void, never, ChangeOwnPasswordBody>('PUT', 'account/password', {
    access: 'gameMaster',
  }),
};
