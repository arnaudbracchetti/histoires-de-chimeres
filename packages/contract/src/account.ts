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
  /** Le pseudo de son participant, tel qu'il s'affiche. */
  nickname: string;
  organizer: boolean;
  /** Son MJ, si son participant en est un (ADR 0012), sinon `null`. */
  gameMasterId: string | null;
};

/**
 * Le compte du back office et sa session (ADR 0019). La session tient dans un cookie `HttpOnly`,
 * posé par `logIn` et effacé par `logOut`.
 */
export const accountEndpoints = {
  /** Lire son propre compte : refusé sans session par `not-logged-in`. */
  read: endpoint<ConnectedAccountDto>('GET', 'account'),
  /**
   * Se connecter : un pseudo inconnu et un mauvais mot de passe donnent la même réponse,
   * `wrong-credentials`. Au-delà de la limite des essais : `too-many-login-attempts` (ADR 0018).
   */
  logIn: endpoint<ConnectedAccountDto, never, LogInBody>('POST', 'account/session'),
  /** Se déconnecter : supprime la session en base ; sans effet sans session. */
  logOut: endpoint<void>('DELETE', 'account/session'),
  /**
   * Changer son mot de passe : ferme ses autres sessions, garde celle en cours (ADR 0019). Un mot
   * de passe actuel faux donne `current-password-wrong` ; sans session, `not-logged-in`. Après un
   * oubli, c'est le lien d'accès qui fait choisir un nouveau mot de passe (ADR 0018).
   */
  changePassword: endpoint<void, never, ChangeOwnPasswordBody>('PUT', 'account/password'),
};
