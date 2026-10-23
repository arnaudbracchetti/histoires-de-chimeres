/** Port de lecture des images de scénario. */
export interface ScenarioImageReader {
  /** Les octets WebP de l'image, ou `null` si elle n'existe pas, ou plus. */
  read(scenarioId: string, imageId: string): Promise<Uint8Array | null>;
}
