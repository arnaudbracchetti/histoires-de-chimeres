// Hook PreToolUse (Bash) : refuse `pnpm --filter <paquet> test… -- <fichier>`.
// Avec `--`, Vitest et `ng test` ignorent le filtre et lancent toute la suite : 250 à 300 s
// pour la suite e2e de l'API, au lieu de quelques secondes pour un fichier.
import { readFileSync } from 'node:fs';

const { tool_input: { command = '' } = {} } = JSON.parse(readFileSync(0, 'utf8'));

// Une commande à la fois : on coupe sur ; && || | et les retours à la ligne. La commande commence
// par `pnpm`, après d'éventuelles variables (`CI=1 pnpm …`) : un message de commit qui la cite passe.
const filteredTestWithDoubleDash =
  /^\s*(?:\w+=\S*\s+)*pnpm\b(?=.*\s--filter[\s=])(?=.*\stest(?::e2e)?\b).*\s--\s/;
const offending = command
  .split(/;|&&|\|\||\||\n/)
  .some((part) => filteredTestWithDoubleDash.test(part));

if (offending) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Avec `--`, Vitest et `ng test` lancent toute la suite au lieu du fichier visé. Retire le `--` : ' +
          '`pnpm --filter api test:e2e src/…/x.e2e-spec.ts`, `pnpm --filter domain test src/…/x.spec.ts`, ' +
          '`pnpm --filter front-office test --include src/…/x.spec.ts`.',
      },
    }),
  );
}
