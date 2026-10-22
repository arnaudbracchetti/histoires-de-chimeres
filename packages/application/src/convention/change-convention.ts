import type { Convention } from '@chimeres/domain';
import { StaleConventionError, type ConventionRepository } from './convention-repository.js';

/**
 * Charge la convention, lui applique `action`, puis la sauvegarde. Sur une version périmée, rejoue
 * une fois sur l'état frais, ce qui revérifie les règles ; au second conflit, l'erreur remonte.
 */
export async function changeConvention(
  repository: ConventionRepository,
  action: (convention: Convention) => void,
): Promise<void> {
  try {
    await attempt(repository, action);
  } catch (error) {
    if (!(error instanceof StaleConventionError)) throw error;
    await attempt(repository, action);
  }
}

async function attempt(
  repository: ConventionRepository,
  action: (convention: Convention) => void,
): Promise<void> {
  const convention = await repository.get();
  action(convention);
  await repository.save(convention);
}
