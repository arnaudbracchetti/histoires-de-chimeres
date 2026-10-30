import type { Convention } from '@chimeres/domain';
import { StaleConventionError, type ConventionRepository } from './convention-repository.js';

/**
 * Charge la convention, lui applique `action`, puis la sauvegarde, sauf si `changed` dit que le
 * résultat de l'action ne change rien. Sur une version périmée, rejoue une fois sur l'état frais,
 * ce qui revérifie les règles ; au second conflit, l'erreur remonte. Rend le résultat de l'action,
 * celui de la tentative sauvegardée : les notifications d'une tentative ratée ne partent jamais.
 */
export async function changeConvention<T>(
  repository: ConventionRepository,
  action: (convention: Convention) => T,
  changed: (result: T) => boolean = () => true,
): Promise<T> {
  try {
    return await attempt(repository, action, changed);
  } catch (error) {
    if (!(error instanceof StaleConventionError)) throw error;
    return attempt(repository, action, changed);
  }
}

async function attempt<T>(
  repository: ConventionRepository,
  action: (convention: Convention) => T,
  changed: (result: T) => boolean,
): Promise<T> {
  const convention = await repository.get();
  const result = action(convention);
  if (changed(result)) await repository.save(convention);
  return result;
}
