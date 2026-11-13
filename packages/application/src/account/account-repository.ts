import type { Account } from '@chimeres/domain';

/** Port d'écriture des comptes (ADR 0015). */
export interface AccountRepository {
  /** Le compte dont le participant porte ce pseudo, comparé comme ID-7, ou `null`. */
  findByNickname(nickname: string): Promise<Account | null>;
  /** Le compte, ou `null` s'il n'existe plus. */
  findById(accountId: string): Promise<Account | null>;
  /** Tous les comptes, dans un ordre quelconque. */
  list(): Promise<Account[]>;
  /** Le compte de ce participant, ou `null` s'il n'en a pas. */
  findByParticipantId(participantId: string): Promise<Account | null>;
  /** Le compte dont le dernier lien d'accès a cette empreinte de jeton, ou `null`. */
  findByAccessLinkTokenHash(tokenHash: string): Promise<Account | null>;
  /**
   * Enregistre l'usage du lien d'accès et le mot de passe choisi, seulement si le compte a encore ce
   * lien, pas encore utilisé. Rend faux sinon : un autre envoi l'a utilisé, ou un nouveau lien l'a
   * remplacé entre-temps (ADR 0018).
   */
  saveAccessLinkUse(account: Account, usedTokenHash: string): Promise<boolean>;
  save(account: Account): Promise<void>;
  /** Supprime le compte, avec ses sessions. */
  remove(account: Account): Promise<void>;
}
