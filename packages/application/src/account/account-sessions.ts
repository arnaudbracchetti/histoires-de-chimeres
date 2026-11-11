/**
 * Port des sessions du back office (ADR 0019) : un mécanisme de l'API, hors du domaine. L'identifiant
 * d'une session est la valeur de son cookie ; seule son empreinte est gardée. La durée de vie (7 jours
 * d'inactivité, 30 jours au plus) est celle de l'implémentation.
 */
export interface AccountSessions {
  /** Ouvre une session neuve pour ce compte, et rend son identifiant. */
  open(accountId: string): Promise<string>;
  /** Le compte de la session si elle vit encore, en la prolongeant, ou `null`. */
  findAccountIdAndExtend(sessionId: string): Promise<string | null>;
  /** Ferme cette session ; sans effet si elle n'existe pas. */
  close(sessionId: string): Promise<void>;
  /** Ferme toutes les sessions du compte. */
  closeAllOfAccount(accountId: string): Promise<void>;
}
