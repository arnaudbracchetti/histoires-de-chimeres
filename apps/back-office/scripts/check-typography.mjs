// Garde-fou de la typographie française (docs/design/ton.md), lancé par `pnpm lint`.
// 1. Aucune espace insécable ni fine insécable écrite en clair : invisibles, elles ne se relisent pas.
//    Le code passe par NBSP et THIN_NBSP (src/app/typography/french.ts), un gabarit par &nbsp; et &#8239;.
// 2. Hors spec, hors commentaire et hors du module typography/ qui la définit, des guillemets
//    entourés d'espaces ordinaires n'apparaissent que dans une phrase étiquetée fr`…`, qui pose
//    elle-même les espaces insécables.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.argv[2] ?? 'src';
const SPECIAL_SPACE = /[\u00a0\u202f]/;
const LOOSE_QUOTES = /« | »/;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|<!--)/;
const HTML_COMMENT = /<!--.*?-->/g;

function* sourceFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|html|css)$/.test(entry.name)) yield path;
  }
}

const problems = [];
for (const file of sourceFiles(root)) {
  const exempt = file.endsWith('.spec.ts') || file.includes(join('app', 'typography'));
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const where = `${relative(process.cwd(), file)}:${index + 1}`;
      if (SPECIAL_SPACE.test(line)) {
        problems.push(`${where} : espace insécable écrite en clair, passer par NBSP ou THIN_NBSP.`);
      }
      if (exempt || COMMENT_LINE.test(line) || line.includes('fr`')) return;
      if (LOOSE_QUOTES.test(line.replace(HTML_COMMENT, ''))) {
        problems.push(`${where} : guillemets sans espaces insécables, étiqueter la phrase fr\`…\`, ou écrire &nbsp; dans un gabarit.`);
      }
    });
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
