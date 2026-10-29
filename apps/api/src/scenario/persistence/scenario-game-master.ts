import type { ScenarioGameMasterDto } from '@chimeres/contract';
import type { Prisma } from '../../generated/prisma/client.js';

/** Le MJ d'un scénario, dont le pseudo est celui de son participant (ADR 0012). */
export const SCENARIO_GAME_MASTER_SELECT = {
  select: { id: true, participant: { select: { nickname: true } } },
} satisfies Prisma.GameMasterDefaultArgs;

type ScenarioGameMasterRow = Prisma.GameMasterGetPayload<typeof SCENARIO_GAME_MASTER_SELECT>;

export function toScenarioGameMaster({
  id,
  participant,
}: ScenarioGameMasterRow): ScenarioGameMasterDto {
  return { id, nickname: participant.nickname };
}
