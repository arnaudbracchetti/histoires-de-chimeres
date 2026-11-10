import { countOf, fr } from '@chimeres/design';

/**
 * Ce que deviennent les téléphones reliés d'un pseudo qui disparaît, supprimé (ID-10) ou fusionné
 * (ID-11) : ils reviennent à l'identification. Rien sans téléphone.
 */
export function linkedPhonesConsequence(phoneCount: number): string[] {
  if (phoneCount === 1) return [fr`Son téléphone relié reviendra à l'identification.`];
  if (phoneCount > 1) {
    return [
      fr`Ses ${countOf(phoneCount, 'téléphone relié', 'téléphones reliés')} reviendront à l'identification.`,
    ];
  }
  return [];
}
