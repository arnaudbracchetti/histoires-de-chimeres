import type { ParticipantAccountDto } from '@chimeres/contract';
import type { Account, Convention, LocalMoment } from '@chimeres/domain';
import { toLocalMomentDto } from '../account/local-moment-dto.js';

/**
 * Le compte du pseudo : son seul rôle, son état, la fin de son lien quand elle compte, et le temps
 * qui lui reste en attente.
 */
export function toParticipantAccountDto(
  account: Account,
  convention: Convention,
  now: LocalMoment,
): ParticipantAccountDto {
  const state = account.computeAccessState(now);
  const expiresAt = account.accessLinkExpiresAt;
  const linkToFollow = expiresAt && (state === 'pending' || state === 'expired');
  return {
    onlyRole: account.findOnlyRole(convention),
    state,
    accessLinkExpiresAt: linkToFollow ? toLocalMomentDto(expiresAt) : null,
    accessLinkRemainingMinutes: account.computeAccessLinkRemainingMinutes(now),
  };
}
