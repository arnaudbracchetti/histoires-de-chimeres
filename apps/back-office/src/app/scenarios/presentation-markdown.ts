import { Marked, type TokenizerObject } from 'marked';

/** Un tokenizer qui ne reconnaît rien : sa syntaxe reste du texte, affiché tel quel. */
const ignored = () => undefined;

/**
 * Markdown restreint de la présentation (PR-1) : paragraphes, gras, italique et listes. Titres,
 * liens, images, citations, code et HTML restent du texte, échappé.
 */
const markdown = new Marked({
  gfm: false,
  tokenizer: {
    code: ignored,
    fences: ignored,
    heading: ignored,
    lheading: ignored,
    hr: ignored,
    blockquote: ignored,
    html: ignored,
    def: ignored,
    tag: ignored,
    link: ignored,
    reflink: ignored,
    autolink: ignored,
    codespan: ignored,
    br: ignored,
  } satisfies Partial<Record<keyof TokenizerObject, typeof ignored>> as TokenizerObject,
});

/** Le HTML de la présentation. À afficher par `[innerHTML]`, qui le passe par le sanitizer d'Angular. */
export function renderPresentation(text: string): string {
  return markdown.parse(text, { async: false });
}
