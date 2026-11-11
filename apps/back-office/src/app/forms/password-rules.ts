import { validate, type SchemaPath } from '@angular/forms/signals';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@chimeres/contract';
import { countOf, fr } from '@chimeres/design';

/**
 * Le mot de passe choisi pour un compte (ADR 0018) : de 10 à 128 caractères, espaces compris,
 * comptés un par un comme le domaine, émojis compris. L'égalité au pseudo reste à l'API.
 */
export function passwordRules(path: SchemaPath<string>): void {
  validate(path, ({ value }) => {
    const length = [...value()].length;
    if (length < PASSWORD_MIN_LENGTH) {
      return {
        kind: 'too-short',
        message: fr`Le mot de passe fait au moins ${countOf(PASSWORD_MIN_LENGTH, 'caractère', 'caractères')} : une courte phrase convient.`,
      };
    }
    if (length > PASSWORD_MAX_LENGTH) {
      return {
        kind: 'too-long',
        message: fr`Le mot de passe fait ${countOf(PASSWORD_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-le.`,
      };
    }
    return undefined;
  });
}
