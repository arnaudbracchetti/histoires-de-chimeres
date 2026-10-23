import { validate, type SchemaPath } from '@angular/forms/signals';

/**
 * Texte borné, obligatoire si `messages.required` est donné. Compté comme le domaine, sans les
 * espaces du début et de la fin : un texte d'espaces seuls est vide.
 */
export function textRules(
  path: SchemaPath<string>,
  max: number,
  messages: { required?: string; tooLong: string },
): void {
  if (messages.required) {
    const message = messages.required;
    validate(path, ({ value }) => (value().trim() ? undefined : { kind: 'required', message }));
  }
  validate(path, ({ value }) =>
    value().trim().length <= max ? undefined : { kind: 'too-long', message: messages.tooLong },
  );
}
