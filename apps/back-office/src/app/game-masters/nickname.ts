import type { SchemaPath } from '@angular/forms/signals';
import { NICKNAME_MAX_LENGTH } from '@chimeres/contract';
import { textRules } from '../forms/text-rules';
import { countOf, fr } from '../typography/french';

/**
 * Erreurs locales d'un pseudo (docs/design/patterns.md, Validation). Le pseudo déjà pris (ID-7)
 * vient de l'API.
 */
export function nicknameRules(path: SchemaPath<string>): void {
  textRules(path, NICKNAME_MAX_LENGTH, {
    required: 'Donne un pseudo au MJ.',
    tooLong: fr`Un pseudo fait ${countOf(NICKNAME_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-le.`,
  });
}
