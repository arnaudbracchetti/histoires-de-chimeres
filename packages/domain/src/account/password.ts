import { ComparableName } from '../comparable-name.js';
import { Refusal } from '../refusal.js';

/**
 * Mot de passe choisi pour un compte, en clair, vérifié (ADR 0018) : de 10 à 128 caractères,
 * espaces compris, sans règle de composition, et différent du pseudo, comparé comme ID-7. Seul un
 * mot de passe vérifié se hache : le domaine n'entre jamais dans le hachage.
 */
export class Password {
  static readonly MIN_LENGTH = 10;
  static readonly MAX_LENGTH = 128;

  private constructor(readonly text: string) {}

  /** Le mot de passe de ce pseudo, ou un refus. Les caractères se comptent un par un, émojis compris. */
  static createForNickname(text: string, nickname: ComparableName): Password {
    const length = [...text].length;
    if (length < Password.MIN_LENGTH) {
      throw new Refusal('password-too-short', { min: Password.MIN_LENGTH });
    }
    if (length > Password.MAX_LENGTH) {
      throw new Refusal('password-too-long', { max: Password.MAX_LENGTH });
    }
    if (ComparableName.createFromText(text).equals(nickname)) {
      throw new Refusal('password-is-nickname', {});
    }
    return new Password(text);
  }
}
