import type { SchemaPath } from '@angular/forms/signals';
import { NICKNAME_MAX_LENGTH } from '@chimeres/contract';
import { textRules } from '../forms/text-rules';

/**
 * Erreurs locales d'un pseudo (docs/design/patterns.md, Validation). Le pseudo déjà pris (ID-7)
 * vient de l'API.
 */
export function nicknameRules(path: SchemaPath<string>): void {
  textRules(path, NICKNAME_MAX_LENGTH, {
    required: 'Donne un pseudo au MJ.',
    tooLong: `Un pseudo fait ${NICKNAME_MAX_LENGTH} caractères au plus : raccourcis-le.`,
  });
}

/** Forme de recherche d'un pseudo : sans casse, sans accent, espaces réduits (ID-7). */
export function searchKey(text: string): string {
  return text.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ');
}
