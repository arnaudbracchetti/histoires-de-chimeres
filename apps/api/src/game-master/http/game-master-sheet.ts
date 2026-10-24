import type { ReadGameMaster } from '@chimeres/application';
import type { GameMasterSheetDto } from '@chimeres/contract';
import { Refusal } from '@chimeres/domain';
import { verdictOf } from '../../http/problem-catalogue.js';

/**
 * La fiche du MJ, chaque refus de retrait avec son motif et sa phrase. Un MJ inconnu répond 404,
 * comme le refus du domaine pour une écriture : il a pu être supprimé entre l'écriture et la
 * relecture.
 */
export async function readSheetOrRefuse(
  readGameMaster: ReadGameMaster,
  gameMasterId: string,
): Promise<GameMasterSheetDto> {
  const sheet = await readGameMaster.execute(gameMasterId);
  if (!sheet) throw new Refusal('game-master-not-found', {});
  return {
    ...sheet,
    withdrawals: sheet.withdrawals.map(({ timeSlotId, refusal }) => ({
      timeSlotId,
      refusal: refusal && verdictOf(refusal),
    })),
  };
}
