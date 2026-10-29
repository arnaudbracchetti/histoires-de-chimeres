import { Marked, type TokenizerObject } from 'marked';

/** Un tokenizer qui ne reconnaît rien : sa syntaxe reste du texte, affiché tel quel. */
const ignored = () => undefined;

/**
 * Niveaux des intertitres : sous les titres de l'écran qui affiche la présentation (h1, h2). « # »
 * devient h3, « ## » h4, et « ### » ou plus h5.
 */
const FIRST_HEADING_LEVEL = 3;
const LAST_HEADING_LEVEL = 5;

/**
 * Markdown de la présentation (PR-1) : paragraphes, retours à la ligne, gras, italique, listes,
 * intertitres, citations, code et séparateurs. Liens, images, adresses, HTML et tableaux restent du
 * texte, échappé : rien ne mène hors de l'application ni ne charge quoi que ce soit. Un titre devient
 * un intertitre, de trois niveaux au plus, que `presentation.css` distingue des titres de l'écran.
 */
const markdown = new Marked({
  gfm: true,
  breaks: true,
  tokenizer: {
    html: ignored,
    def: ignored,
    tag: ignored,
    link: ignored,
    reflink: ignored,
    autolink: ignored,
    url: ignored,
    table: ignored,
    del: ignored,
  } satisfies Partial<Record<keyof TokenizerObject, typeof ignored>> as TokenizerObject,
  renderer: {
    heading({ tokens, depth }) {
      const level = Math.min(FIRST_HEADING_LEVEL - 1 + depth, LAST_HEADING_LEVEL);
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
  },
});

/**
 * Importé par sa propre entrée, `@chimeres/design/presentation` : `marked` ne pèse que sur les écrans
 * qui affichent une présentation.
 *
 * Le HTML de la présentation, le même dans l'aperçu du back office et sur la fiche du front office.
 * À afficher par `[innerHTML]`, qui le passe par le sanitizer d'Angular.
 */
export function renderPresentation(text: string): string {
  return markdown.parse(text, { async: false });
}
