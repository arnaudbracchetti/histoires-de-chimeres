import { validate, type SchemaPath } from '@angular/forms/signals';

/**
 * Texte borné, obligatoire si `messages.required` est donné : un texte, ou une fonction lue à la
 * validation. Compté comme le domaine, sans les espaces du début et de la fin : un texte d'espaces
 * seuls est vide.
 */
export function textRules(
  path: SchemaPath<string>,
  max: number,
  messages: { required?: string | (() => string); tooLong: string },
): void {
  const required = messages.required;
  if (required) {
    validate(path, ({ value }) =>
      value().trim()
        ? undefined
        : { kind: 'required', message: typeof required === 'function' ? required() : required },
    );
  }
  validate(path, ({ value }) =>
    value().trim().length <= max ? undefined : { kind: 'too-long', message: messages.tooLong },
  );
}
