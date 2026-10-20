/**
 * Jeton d'injection du port ConventionReader (une interface n'existe pas à l'exécution).
 * Dans son propre fichier : le module et le controller l'importent tous deux, et le placer
 * dans le module créerait un import circulaire (jeton `undefined` au moment du décorateur).
 */
export const CONVENTION_READER = Symbol('ConventionReader');
