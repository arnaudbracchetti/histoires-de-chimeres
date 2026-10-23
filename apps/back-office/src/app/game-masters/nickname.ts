import { validate, type SchemaPath } from '@angular/forms/signals';
import { NICKNAME_MAX_LENGTH } from '@chimeres/contract';

/**
 * Erreurs locales d'un pseudo (docs/design/patterns.md, Validation), comptées comme le domaine,
 * sans les espaces du début et de la fin. Le pseudo déjà pris (ID-7) vient de l'API.
 */
export function nicknameRules(path: SchemaPath<string>): void {
  validate(path, ({ value }) =>
    value().trim() ? undefined : { kind: 'required', message: 'Donne un pseudo au MJ.' },
  );
  validate(path, ({ value }) =>
    value().trim().length <= NICKNAME_MAX_LENGTH
      ? undefined
      : {
          kind: 'too-long',
          message: `Un pseudo fait ${NICKNAME_MAX_LENGTH} caractères au plus : raccourcis-le.`,
        },
  );
}

/** Forme de recherche d'un pseudo : sans casse, sans accent, espaces réduits (ID-7). */
export function searchKey(text: string): string {
  return text.trim().normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ');
}
