import { describe, expect, it } from 'vitest';
import { renderPresentation } from './presentation-markdown.js';

describe('renderPresentation', () => {
  it('rend les paragraphes, le gras et l’italique', () => {
    expect(renderPresentation('Une **tour**, une *nuit*.\n\nUn secret.')).toBe(
      '<p>Une <strong>tour</strong>, une <em>nuit</em>.</p>\n<p>Un secret.</p>\n',
    );
  });

  it('rend les retours à la ligne', () => {
    expect(renderPresentation('Une tour.\nUne nuit.')).toBe('<p>Une tour.<br>Une nuit.</p>\n');
  });

  it('rend les listes', () => {
    expect(renderPresentation('- un\n- deux')).toBe('<ul>\n<li>un</li>\n<li>deux</li>\n</ul>\n');
  });

  it.each([
    ['#', 'h3', '# Le *phare*'],
    ['souligné de =', 'h3', 'Le *phare*\n==='],
    ['##', 'h4', '## Le *phare*'],
    ['souligné de -', 'h4', 'Le *phare*\n---'],
    ['###', 'h5', '### Le *phare*'],
    ['######', 'h5', '###### Le *phare*'],
  ])(
    'rend un titre %s en intertitre %s, sous les titres de l’écran (h1, h2)',
    (_, tag, markdown) => {
      expect(renderPresentation(markdown)).toBe(`<${tag}>Le <em>phare</em></${tag}>\n`);
    },
  );

  it('rend les citations', () => {
    expect(renderPresentation('> dit-il')).toBe('<blockquote>\n<p>dit-il</p>\n</blockquote>\n');
  });

  it('rend le code, en ligne et en bloc', () => {
    expect(renderPresentation('Un `d20`.')).toBe('<p>Un <code>d20</code>.</p>\n');
    expect(renderPresentation('```\n1d6\n```')).toBe('<pre><code>1d6\n</code></pre>\n');
  });

  it('rend les séparateurs', () => {
    expect(renderPresentation('Avant\n\n---\n\nAprès')).toBe('<p>Avant</p>\n<hr>\n<p>Après</p>\n');
  });

  it.each([
    ['un lien', '[site](https://exemple.fr)', '<p>[site](https://exemple.fr)</p>\n'],
    ['une image', '![x](https://exemple.fr/a.png)', '<p>![x](https://exemple.fr/a.png)</p>\n'],
    ['une adresse', '<https://exemple.fr>', '<p>&lt;https://exemple.fr&gt;</p>\n'],
    ['une adresse nue', 'Voir https://exemple.fr', '<p>Voir https://exemple.fr</p>\n'],
    ['du HTML', '<b>gras</b>', '<p>&lt;b&gt;gras&lt;/b&gt;</p>\n'],
    ['un tableau', '| a |\n|---|\n| b |', '<p>| a |<br>|---|<br>| b |</p>\n'],
  ])('affiche %s tel quel', (_, markdown, html) => {
    expect(renderPresentation(markdown)).toBe(html);
  });
});
