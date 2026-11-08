import type { ParticipantResultDto } from '@chimeres/contract';
import { countOf, fr } from '@chimeres/design';

/**
 * Le résultat d'un pseudo sur un créneau, en deux lignes : l'essentiel, puis le détail, ou `null`.
 * `tone` : « Non placé » en rouge brique (`danger`), « Aucune inscription » atténué (`muted`).
 */
export type ResultLines = {
  main: string;
  detail: string | null;
  tone: 'danger' | 'muted' | null;
};

/** Les phrases du résultat (docs/design/patterns.md, Fiche d'un pseudo). */
export function describeParticipantResult(result: ParticipantResultDto): ResultLines {
  switch (result.kind) {
    case 'assigned':
      return {
        main: fr`Table ${result.tableName}`,
        detail: fr`${result.title}, avec ${result.gameMasterNickname}`,
        tone: null,
      };
    case 'unassigned': {
      const tables = result.tablesWithSeats.map(
        ({ tableName, freeSeatCount }) => fr`${tableName} (${freeSeatCount})`,
      );
      return {
        main: 'Non placé',
        detail: tables.length
          ? fr`Il reste de la place à ${tables.join(', ')}.`
          : 'Toutes les parties du créneau sont complètes.',
        tone: 'danger',
      };
    }
    case 'leading':
      return { main: fr`Mène ${result.title}`, detail: fr`Table ${result.tableName}`, tone: null };
    case 'not-in-draw':
      return { main: 'Pas dans le tirage', detail: null, tone: null };
    case 'signed-up':
      return result.signUpCount
        ? {
            main: countOf(result.signUpCount, 'inscription', 'inscriptions'),
            detail: null,
            tone: null,
          }
        : { main: 'Aucune inscription', detail: null, tone: 'muted' };
  }
}
