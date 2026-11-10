import type { MergeTimeSlotVerdictDto, MergeVerdictDto } from '@chimeres/contract';
import { formatList, fr } from '@chimeres/design';
import { linkedPhonesConsequence } from './linked-phones-consequence';

/** Les pseudos de la fusion, et le nombre de téléphones reliés à la source. */
export type MergeNames = { source: string; destination: string; phones: number };

/**
 * Ce que la fusion fera (ID-11, docs/design/patterns.md, Fiche d'un pseudo), d'après le verdict de
 * l'API, un paragraphe par fait, créneau par créneau : l'affectation de la source, la destination
 * qui quitte un tirage pour une partie double (TI-3), les inscriptions qui passent, en secours là
 * où la destination mène (IN-4), ou se perdent, l'état sans partie (IN-6). Puis ses téléphones reliés, qui ne passent pas (ID-9), et la
 * suppression de la source. Le front ne recalcule aucune règle.
 */
export function mergeConsequences(verdict: MergeVerdictDto, names: MergeNames): string[] {
  const destination = fr`« ${names.destination} »`;
  const consequences = verdict.timeSlots.flatMap((slot) =>
    describeTimeSlot(slot, destination).map((text) => fr`Créneau ${slot.rank} : ${text}`),
  );
  consequences.push(...linkedPhonesConsequence(names.phones));
  consequences.push(fr`« ${names.source} » sera supprimé, et son pseudo redeviendra libre.`);
  return consequences;
}

/** Les faits d'un créneau, sans le créneau. */
function describeTimeSlot(slot: MergeTimeSlotVerdictDto, destination: string): string[] {
  const facts: string[] = [];
  const { assignment } = slot;
  if (assignment) {
    const game = assignment.title && fr`${assignment.title}, table ${assignment.tableName}`;
    if (assignment.outcome === 'lost') {
      facts.push(
        game ? fr`sa place à ${game}, est perdue.` : fr`sa place de non placé est perdue.`,
      );
    } else {
      facts.push(
        game
          ? fr`${destination} prend sa place à ${game}.`
          : fr`${destination} reprend sa place de non placé dans le tirage.`,
      );
    }
  }
  if (slot.destinationLeavesDraw) {
    facts.push(
      fr`${destination} quitte le tirage, pour jouer la partie double du créneau d'avant.`,
    );
  }
  facts.push(
    ...describeSignUps(
      slot.transferredSignUpTitles,
      fr`passe à ${destination}`,
      fr`passent à ${destination}`,
    ),
  );
  facts.push(
    ...describeSignUps(
      slot.backupSignUpTitles,
      fr`passe à ${destination}, en secours`,
      fr`passent à ${destination}, en secours`,
    ),
  );
  facts.push(...describeSignUps(slot.lostSignUpTitles, fr`est perdue`, fr`sont perdues`));
  if (slot.withoutGame === 'transferred') {
    facts.push(fr`${destination} devient sans partie, et reste dans le tirage.`);
  }
  if (slot.withoutGame === 'lost') facts.push(fr`${destination} ne devient pas sans partie.`);
  return facts;
}

/** « son inscription à Néons <verbe>. », ou « ses inscriptions à Néons et Brumes <verbe>. » ; rien sans titre. */
function describeSignUps(titles: string[], singular: string, plural: string): string[] {
  if (titles.length === 1) return [fr`son inscription à ${titles[0]} ${singular}.`];
  if (titles.length > 1) return [fr`ses inscriptions à ${formatList(titles)} ${plural}.`];
  return [];
}
