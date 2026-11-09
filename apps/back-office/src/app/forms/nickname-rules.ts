import type { SchemaPath } from '@angular/forms/signals';
import { NICKNAME_MAX_LENGTH } from '@chimeres/contract';
import { countOf, fr } from '@chimeres/design';
import { textRules } from './text-rules';

/** Le message d'un pseudo manquant, selon celui qui le portera. */
const REQUIRED_MESSAGES = {
  'game-master': 'Donne un pseudo au MJ.',
  participant: 'Donne un pseudo.',
} as const;

/**
 * Erreurs locales d'un pseudo, de MJ ou de participant (docs/design/patterns.md, Validation). Le
 * pseudo déjà pris (ID-7) vient de l'API.
 */
export function nicknameRules(
  path: SchemaPath<string>,
  owner: keyof typeof REQUIRED_MESSAGES,
): void {
  textRules(path, NICKNAME_MAX_LENGTH, {
    required: REQUIRED_MESSAGES[owner],
    tooLong: fr`Un pseudo fait ${countOf(NICKNAME_MAX_LENGTH, 'caractère', 'caractères')} au plus : raccourcis-le.`,
  });
}
