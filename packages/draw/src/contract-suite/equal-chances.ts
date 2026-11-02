import type { DrawAlgorithm, DrawInput, DrawParticipant } from '@chimeres/domain';
import { createSeededRandom } from '../seeded-random.js';

/** Un participant dont la part d'une issue s'écarte trop de celle de son groupe. */
export type UnequalChance = {
  participantId: string;
  /** La partie, ou `null` : non placé. */
  outcome: string | null;
  /** La part des tirages où il a obtenu cette issue. */
  share: number;
  /** La part moyenne de son groupe. */
  groupShare: number;
  tolerance: number;
};

/**
 * La promesse « mêmes inscriptions, mêmes chances » (TI-4), vérifiée sur `runs` tirages du même
 * créneau, à graine fixe : le verdict est toujours le même. Les participants aux inscriptions
 * identiques forment un groupe. Pour chaque issue (chaque partie de leurs inscriptions, et « non
 * placé »), la part des tirages où chacun l'obtient ne doit pas s'écarter de la part moyenne du
 * groupe de plus de 5 écarts types du hasard, racine de p(1 - p) / runs. Rend les écarts de trop.
 *
 * Le créneau doit couper des groupes en deux (des membres placés et d'autres non, ou répartis sur
 * deux tables) : sinon, un algorithme qui ignore le hasard passe aussi.
 */
export function listUnequalChances(
  algorithm: DrawAlgorithm,
  input: DrawInput,
  runs: number,
  seed: number,
): UnequalChance[] {
  const random = createSeededRandom(seed);
  const outcomeCounts = new Map(
    input.participants.map(({ id }) => [id, new Map<string | null, number>()]),
  );
  for (let run = 0; run < runs; run++) {
    for (const { participantId, gameId } of algorithm.computeAssignments(input, random)) {
      // Un participant hors de l'entrée relève des règles absolues, pas de ce test.
      const counts = outcomeCounts.get(participantId);
      counts?.set(gameId, (counts.get(gameId) ?? 0) + 1);
    }
  }
  const computeShare = (participant: DrawParticipant, outcome: string | null) =>
    (outcomeCounts.get(participant.id)!.get(outcome) ?? 0) / runs;

  return groupByGameIds(input.participants).flatMap((group) => {
    const outcomes = [...group[0]!.gameIds, null];
    return outcomes.flatMap((outcome) => {
      const groupShare = mean(group.map((participant) => computeShare(participant, outcome)));
      const tolerance = 5 * Math.sqrt((groupShare * (1 - groupShare)) / runs);
      return group
        .filter(
          (participant) => Math.abs(computeShare(participant, outcome) - groupShare) > tolerance,
        )
        .map((participant) => ({
          participantId: participant.id,
          outcome,
          share: computeShare(participant, outcome),
          groupShare,
          tolerance,
        }));
    });
  });
}

/** Les groupes de participants aux inscriptions identiques. */
function groupByGameIds(participants: readonly DrawParticipant[]): DrawParticipant[][] {
  const groups = new Map<string, DrawParticipant[]>();
  for (const participant of participants) {
    const key = [...participant.gameIds].sort().join(' ');
    groups.set(key, [...(groups.get(key) ?? []), participant]);
  }
  return [...groups.values()];
}

function mean(numbers: readonly number[]): number {
  return numbers.reduce((total, number) => total + number, 0) / numbers.length;
}
