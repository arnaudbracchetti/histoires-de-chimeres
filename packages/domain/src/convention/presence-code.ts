/** Majuscules et chiffres, sans 0, O, 1, I ni L, qui se confondent à la lecture de l'affiche. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 4;
const PATTERN = new RegExp(`^[${ALPHABET}]{${LENGTH}}$`);

/**
 * Code de présence de la convention (ID-2) : 4 caractères parmi 31. La migration de la convention
 * le tire au hasard, et il ne change plus.
 */
export class PresenceCode {
  private constructor(readonly text: string) {}

  /** Lit un code bien formé. Une autre forme est une erreur de l'appelant, pas un refus. */
  static parse(text: string): PresenceCode {
    if (!PATTERN.test(text)) throw new RangeError(`Code de présence invalide : ${text}`);
    return new PresenceCode(text);
  }

  /** Le code présenté est celui-ci, à la casse et aux espaces du début et de la fin près. */
  matchesPresentedCode(presented: string): boolean {
    return presented.trim().toUpperCase() === this.text;
  }
}
