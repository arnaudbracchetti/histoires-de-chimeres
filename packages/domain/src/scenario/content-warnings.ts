import { Refusal } from '../refusal.js';

/** Avertissements de contenu : les thèmes sensibles d'un scénario, en texte libre. Facultatifs. */
export class ContentWarnings {
  /** Reprise par `contract` (`CONTENT_WARNINGS_MAX_LENGTH`) ; un test d'`application` vérifie qu'elles concordent. */
  static readonly MAX_LENGTH = 300;

  private constructor(
    /** Le texte saisi, sans les espaces du début et de la fin ; vide sans avertissement. */
    readonly text: string,
  ) {}

  static createFromText(text: string): ContentWarnings {
    const trimmed = text.trim();
    if (trimmed.length > ContentWarnings.MAX_LENGTH) {
      throw new Refusal('content-warnings-too-long', { max: ContentWarnings.MAX_LENGTH });
    }
    return new ContentWarnings(trimmed);
  }

  get isEmpty(): boolean {
    return !this.text;
  }
}
