import type { ParticipantSheetDto } from '@chimeres/contract';
import { countOf, fr } from '@chimeres/design';

/**
 * Ce qui part avec un pseudo supprimé (ID-10, docs/design/patterns.md, Actions destructrices) : ses
 * inscriptions, sa place dans les tirages, publiés compris, sans la proposer à personne, et ses
 * téléphones reliés ; puis son pseudo, libéré.
 */
export function removalConsequences(sheet: ParticipantSheetDto): string[] {
  const consequences: string[] = [];
  const signUpCount = sheet.signedUpGameIds.length + sheet.backupGameIds.length;
  if (signUpCount === 1) consequences.push('Son inscription sera supprimée.');
  if (signUpCount > 1) {
    consequences.push(
      `Ses ${countOf(signUpCount, 'inscription', 'inscriptions')} seront supprimées.`,
    );
  }

  const inDraws = sheet.timeSlots.filter(
    ({ result }) => result.kind === 'assigned' || result.kind === 'unassigned',
  );
  if (inDraws.length) {
    const draws = inDraws.some(({ state }) => state === 'published')
      ? 'Il sort des tirages, publiés compris'
      : 'Il sort des tirages';
    consequences.push(
      inDraws.some(({ result }) => result.kind === 'assigned')
        ? fr`${draws} : sa partie comptera un joueur de moins, et sa place ne sera proposée à personne.`
        : `${draws}.`,
    );
  }

  const phoneCount = sheet.linkedPhones.length;
  if (phoneCount === 1) consequences.push("Son téléphone relié reviendra à l'identification.");
  if (phoneCount > 1) {
    consequences.push(
      `Ses ${countOf(phoneCount, 'téléphone relié', 'téléphones reliés')} reviendront à l'identification.`,
    );
  }

  consequences.push('Le pseudo redeviendra libre.');
  return consequences;
}
