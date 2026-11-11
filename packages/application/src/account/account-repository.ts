import type { Account } from '@chimeres/domain';

/** Port d'écriture des comptes (ADR 0015). */
export interface AccountRepository {
  /** Le compte dont le participant porte ce pseudo, comparé comme ID-7, ou `null`. */
  findByNickname(nickname: string): Promise<Account | null>;
  /** Le compte, ou `null` s'il n'existe plus. */
  findById(accountId: string): Promise<Account | null>;
  /** Le compte de ce participant, ou `null` s'il n'en a pas. */
  findByParticipantId(participantId: string): Promise<Account | null>;
  save(account: Account): Promise<void>;
}
