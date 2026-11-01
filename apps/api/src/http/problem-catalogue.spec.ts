import type { ProblemCode } from '@chimeres/contract';
import { problemCatalogue } from './problem-catalogue.js';

/** Des paramètres qui valent 2 quel que soit leur nom : assez pour écrire chaque phrase. */
const anyParams = new Proxy({}, { get: () => 2 });

describe('Catalogue des messages de l’API', () => {
  it.each(Object.keys(problemCatalogue) as ProblemCode[])(
    'écrit « %s » avec les espaces de la typographie française (docs/design/ton.md)',
    (code) => {
      const message = problemCatalogue[code] as {
        title: string;
        detail?: (params: unknown) => string;
      };
      for (const text of [message.title, message.detail?.(anyParams) ?? '']) {
        expect(text).not.toMatch(/ [:;!?»]|« /);
      }
    },
  );
});

describe('Aucune table libre', () => {
  it('dit le créneau, et pour un scénario double aussi le suivant', () => {
    const { detail } = problemCatalogue['no-free-table'];

    expect(detail({ rank: 2, twoSlot: false })).toBe(
      'Toutes les tables sont prises sur le créneau 2.',
    );
    expect(detail({ rank: 2, twoSlot: true })).toBe(
      'Toutes les tables sont prises sur le créneau 2 ou sur le suivant.',
    );
  });
});
