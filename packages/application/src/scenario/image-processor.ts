/** Port du traitement d'image (ADR 0007), implémenté par l'infrastructure. */
export interface ImageProcessor {
  /** L'image prête à servir, ou une erreur si elle est refusée (trop lourde, d'un format refusé, illisible). */
  process(bytes: Uint8Array): Promise<Uint8Array>;
}
