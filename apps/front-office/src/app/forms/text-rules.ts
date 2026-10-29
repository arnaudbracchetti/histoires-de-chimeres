import { validate, type SchemaPath } from '@angular/forms/signals';

/**
 * Texte obligatoire et borné, compté comme le domaine, sans les espaces du début et de la fin : un
 * texte d'espaces seuls est vide.
 */
export function textRules(
  path: SchemaPath<string>,
  max: number,
  messages: { required: string; tooLong: string },
): void {
  validate(path, ({ value }) =>
    value().trim() ? undefined : { kind: 'required', message: messages.required },
  );
  validate(path, ({ value }) =>
    value().trim().length <= max ? undefined : { kind: 'too-long', message: messages.tooLong },
  );
}
