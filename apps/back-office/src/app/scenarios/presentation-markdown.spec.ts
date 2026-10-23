import { renderPresentation } from './presentation-markdown';

describe('renderPresentation', () => {
  it('rend les paragraphes, le gras et l’italique', () => {
    expect(renderPresentation('Une **tour**, une *nuit*.\n\nUn secret.')).toBe(
      '<p>Une <strong>tour</strong>, une <em>nuit</em>.</p>\n<p>Un secret.</p>\n',
    );
  });

  it('rend les listes', () => {
    expect(renderPresentation('- un\n- deux')).toBe('<ul>\n<li>un</li>\n<li>deux</li>\n</ul>\n');
  });

  it.each([
    ['un titre', '# Titre', '<p># Titre</p>\n'],
    ['un lien', '[site](https://exemple.fr)', '<p>[site](https://exemple.fr)</p>\n'],
    ['une image', '![x](https://exemple.fr/a.png)', '<p>![x](https://exemple.fr/a.png)</p>\n'],
    ['une adresse', '<https://exemple.fr>', '<p>&lt;https://exemple.fr&gt;</p>\n'],
    ['du HTML', '<b>gras</b>', '<p>&lt;b&gt;gras&lt;/b&gt;</p>\n'],
    ['une citation', '> dit-il', '<p>&gt; dit-il</p>\n'],
    ['du code', '`code`', '<p>`code`</p>\n'],
  ])('affiche %s tel quel', (_, markdown, html) => {
    expect(renderPresentation(markdown)).toBe(html);
  });
});
