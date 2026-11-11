import type { AccountRole, ParticipantSheetDto } from '@chimeres/contract';
import { fr } from '@chimeres/design';

/**
 * Ce qui part avec un rôle retiré (ID-16, PR-12, docs/design/patterns.md, Actions destructrices) :
 * les disponibilités du MJ ; avec le dernier rôle, le compte, son mot de passe, son lien d'accès et
 * ses sessions, comme l'API le dit sur la fiche. Le pseudo, lui, reste.
 */
export function roleWithdrawalConsequences(
  sheet: ParticipantSheetDto,
  role: AccountRole,
): string[] {
  const consequences: string[] = [];
  if (role === 'game-master') consequences.push(fr`Ses disponibilités seront supprimées.`);
  if (sheet.account?.onlyRole === role) {
    consequences.push(
      fr`Sans autre rôle, son compte sera supprimé, avec son mot de passe, son lien d'accès et ses sessions. « ${sheet.nickname} » reste un participant, avec ses inscriptions et ses téléphones.`,
    );
  } else if (role === 'organizer' && sheet.gameMaster) {
    consequences.push(
      fr`« ${sheet.nickname} » reste MJ : son compte ne donnera plus accès qu'à sa fiche et aux scénarios de la convention.`,
    );
  }
  return consequences;
}
