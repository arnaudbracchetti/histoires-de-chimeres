import type { MergeTimeSlotVerdictDto, MergeVerdictDto } from '@chimeres/contract';
import { countOf, formatList, fr } from '@chimeres/design';

/** Les pseudos de la fusion, et le nombre de téléphones reliés à la source. */
export type MergeNames = { source: string; destination: string; phones: number };

/**
 * Ce que la fusion fera (ID-11, docs/design/patterns.md, Fiche d'un pseudo), d'après le verdict de
 * l'API, un paragraphe par fait, créneau par créneau : l'affectation de la source, la destination
 * qui quitte un tirage pour une partie double (TI-3), les inscriptions qui passent ou se perdent,
 * l'état sans partie (IN-6). Puis ses téléphones reliés, qui ne passent pas (ID-9), et la
 * suppression de la source. Le front ne recalcule aucune règle.
 */
export function mergeConsequences(verdict: MergeVerdictDto, names: MergeNames): string[] {
  const destination = fr`« ${names.destination} »`;
  const consequences = verdict.timeSlots.flatMap((slot) =>
    describeTimeSlot(slot, destination).map((text) => fr`Créneau ${slot.rank} : ${text}`),
  );
  if (names.phones === 1) consequences.push("Son téléphone relié reviendra à l'identification.");
  if (names.phones > 1) {
    consequences.push(
      `Ses ${countOf(names.phones, 'téléphone relié', 'téléphones reliés')} reviendront à l'identification.`,
    );
  }
  consequences.push(fr`« ${names.source} » sera supprimé, et son pseudo redeviendra libre.`);
  return consequences;
}

/** Les faits d'un créneau, sans le créneau. */
function describeTimeSlot(slot: MergeTimeSlotVerdictDto, destination: string): string[] {
  const facts: string[] = [];
  const { assignment } = slot;
  if (assignment) {
    const game = assignment.title && `${assignment.title}, table ${assignment.tableName}`;
    if (assignment.outcome === 'lost') {
      facts.push(game ? `sa place à ${game}, est perdue.` : 'sa place de non placé est perdue.');
    } else {
      facts.push(
        game
          ? `${destination} prend sa place à ${game}.`
          : `${destination} reprend sa place de non placé dans le tirage.`,
      );
    }
  }
  if (slot.destinationLeavesDraw) {
    facts.push(`${destination} quitte le tirage, pour jouer la partie double du créneau d'avant.`);
  }
  const transferred = slot.transferredSignUpTitles;
  if (transferred.length === 1) {
    facts.push(`son inscription à ${transferred[0]} passe à ${destination}.`);
  }
  if (transferred.length > 1) {
    facts.push(`ses inscriptions à ${formatList(transferred)} passent à ${destination}.`);
  }
  const lost = slot.lostSignUpTitles;
  if (lost.length === 1) facts.push(`son inscription à ${lost[0]} est perdue.`);
  if (lost.length > 1) facts.push(`ses inscriptions à ${formatList(lost)} sont perdues.`);
  if (slot.withoutGame === 'transferred') {
    facts.push(`${destination} devient sans partie, et reste dans le tirage.`);
  }
  if (slot.withoutGame === 'lost') facts.push(`${destination} ne devient pas sans partie.`);
  return facts;
}
