import { hasPublishedDraw, type ParticipantSheetDto } from '@chimeres/contract';
import { countOf, fr } from '@chimeres/design';
import { linkedPhonesConsequence } from './linked-phones-consequence';

/**
 * Ce qui part avec un pseudo supprimé (ID-10, docs/design/patterns.md, Actions destructrices) : ses
 * inscriptions, sa place dans les tirages, publiés compris, sans la proposer à personne, et ses
 * téléphones reliés ; puis son pseudo, libéré.
 */
export function removalConsequences(sheet: ParticipantSheetDto): string[] {
  const consequences: string[] = [];
  const signUpCount = sheet.signedUpGameIds.length + sheet.backupGameIds.length;
  if (signUpCount === 1) consequences.push(fr`Son inscription sera supprimée.`);
  if (signUpCount > 1) {
    consequences.push(
      fr`Ses ${countOf(signUpCount, 'inscription', 'inscriptions')} seront supprimées.`,
    );
  }

  const inDraws = sheet.timeSlots.filter(
    ({ result }) => result.kind === 'assigned' || result.kind === 'unassigned',
  );
  if (inDraws.length) {
    const draws = inDraws.some(({ state }) => hasPublishedDraw(state))
      ? 'Il sort des tirages, publiés compris'
      : 'Il sort des tirages';
    consequences.push(
      inDraws.some(({ result }) => result.kind === 'assigned')
        ? fr`${draws} : sa partie comptera un joueur de moins, et sa place ne sera proposée à personne.`
        : fr`${draws}.`,
    );
  }

  consequences.push(...linkedPhonesConsequence(sheet.linkedPhones.length));
  consequences.push(fr`Le pseudo redeviendra libre.`);
  return consequences;
}
