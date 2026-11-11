/** Port de l'empreinte du dernier premier Organisateur appliqué (ADR 0016). */
export interface FirstOrganizerFingerprint {
  /** L'empreinte appliquée, ou `null` si aucune ne l'a été. */
  read(): Promise<string | null>;
  save(fingerprint: string): Promise<void>;
}
