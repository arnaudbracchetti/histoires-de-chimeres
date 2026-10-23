import { describe, expect, it } from 'vitest';
import { Convention } from '../convention/convention.js';
import { Refusal } from '../refusal.js';
import type { ScenarioDetails } from './scenario.js';

function aConvention(): Convention {
  const convention = Convention.restore({
    id: 'c1',
    name: 'Histoires de Chimères',
    date: null,
    timeSlots: [],
    tables: [],
    gameMasters: [],
    games: [],
    version: 0,
  });
  convention.addGameMaster('g1', 'Kaïros');
  return convention;
}

function refusalOf(action: () => void): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error("L'action n'a pas été refusée.");
}

const details = (changes: Partial<ScenarioDetails> = {}): ScenarioDetails => ({
  title: "La Tour d'ébène",
  system: "L'Appel de Cthulhu",
  presentation: 'Une tour, une nuit, **un secret**.',
  contentWarnings: '',
  seats: { min: 3, max: 5 },
  duration: 1,
  ...changes,
});

const aScenario = () => aConvention().proposeScenario('s1', 'g1', details());

describe('Proposer un scénario', () => {
  it('fabrique le scénario du MJ, avec le contenu saisi sans les espaces autour (PR-1, PR-16)', () => {
    const scenario = aConvention().proposeScenario(
      's1',
      'g1',
      details({
        title: "  La Tour d'ébène ",
        system: " L'Appel de Cthulhu  ",
        presentation: '\nUne tour, une nuit.\n\n',
        contentWarnings: '  Folie, huis clos ',
        seats: { min: 2, max: 4 },
        duration: 2,
      }),
    );

    expect(scenario.id).toBe('s1');
    expect(scenario.gameMasterId).toBe('g1');
    expect(scenario.title).toBe("La Tour d'ébène");
    expect(scenario.system).toBe("L'Appel de Cthulhu");
    expect(scenario.presentation).toBe('Une tour, une nuit.');
    expect(scenario.contentWarnings.text).toBe('Folie, huis clos');
    expect(scenario.seats).toMatchObject({ min: 2, max: 4 });
    expect(scenario.duration).toBe(2);
  });

  it('refuse un MJ inexistant', () => {
    const refusal = refusalOf(() => aConvention().proposeScenario('s1', 'inconnu', details()));

    expect(refusal.code).toBe('game-master-not-found');
  });

  it('accepte un scénario sans avertissement de contenu', () => {
    const scenario = aConvention().proposeScenario('s1', 'g1', details({ contentWarnings: '  ' }));

    expect(scenario.contentWarnings.isEmpty).toBe(true);
    expect(scenario.contentWarnings.text).toBe('');
  });
});

describe('Bornes du contenu (PR-1)', () => {
  it.each([
    ['title', 80, 'scenario-title-too-long'],
    ['system', 60, 'system-too-long'],
    ['presentation', 1500, 'presentation-too-long'],
    ['contentWarnings', 300, 'content-warnings-too-long'],
  ] as const)('accepte %s de %i caractères, refuse un de plus', (field, max, code) => {
    expect(() =>
      aConvention().proposeScenario('s1', 'g1', details({ [field]: 'a'.repeat(max) })),
    ).not.toThrow();

    const refusal = refusalOf(() =>
      aConvention().proposeScenario('s1', 'g1', details({ [field]: 'a'.repeat(max + 1) })),
    );

    expect(refusal.code).toBe(code);
    expect(refusal.params).toEqual({ max });
  });

  it.each([
    ['title', 'scenario-title-required'],
    ['system', 'system-required'],
    ['presentation', 'presentation-required'],
  ] as const)('refuse %s vide', (field, code) => {
    const refusal = refusalOf(() =>
      aConvention().proposeScenario('s1', 'g1', details({ [field]: '   ' })),
    );

    expect(refusal.code).toBe(code);
  });
});

describe('Places (PR-1)', () => {
  it.each([
    [1, 1],
    [1, 40],
    [6, 6],
  ])('accepte %i à %i places, sans plafond', (min, max) => {
    const scenario = aConvention().proposeScenario('s1', 'g1', details({ seats: { min, max } }));

    expect(scenario.seats).toMatchObject({ min, max });
  });

  it.each([0, -1])('refuse un minimum de %i', (min) => {
    const refusal = refusalOf(() =>
      aConvention().proposeScenario('s1', 'g1', details({ seats: { min, max: 5 } })),
    );

    expect(refusal.code).toBe('seats-min-below-one');
  });

  it('refuse des places dans le désordre', () => {
    const refusal = refusalOf(() =>
      aConvention().proposeScenario('s1', 'g1', details({ seats: { min: 5, max: 3 } })),
    );

    expect(refusal.code).toBe('seats-out-of-order');
  });
});

describe('Modifier un scénario (PR-14)', () => {
  it('modifie le contenu', () => {
    const scenario = aScenario();

    scenario.changeContent({
      title: ' Les Chiens de la Vigne ',
      system: 'Dogs in the Vineyard',
      presentation: 'Des cavaliers *de Dieu*.',
      contentWarnings: 'Violence',
    });

    expect(scenario.title).toBe('Les Chiens de la Vigne');
    expect(scenario.system).toBe('Dogs in the Vineyard');
    expect(scenario.presentation).toBe('Des cavaliers *de Dieu*.');
    expect(scenario.contentWarnings.text).toBe('Violence');
  });

  it('refuse un contenu hors bornes, et garde l’ancien', () => {
    const scenario = aScenario();

    const refusal = refusalOf(() =>
      scenario.changeContent({ ...details(), title: 'Nouveau', system: '' }),
    );

    expect(refusal.code).toBe('system-required');
    expect(scenario.title).toBe("La Tour d'ébène");
  });

  it('modifie les places', () => {
    const scenario = aScenario();

    scenario.changeSeats({ min: 1, max: 2 });

    expect(scenario.seats).toMatchObject({ min: 1, max: 2 });
  });

  it('refuse des places dans le désordre, et garde les anciennes', () => {
    const scenario = aScenario();

    expect(refusalOf(() => scenario.changeSeats({ min: 4, max: 2 })).code).toBe(
      'seats-out-of-order',
    );
    expect(scenario.seats).toMatchObject({ min: 3, max: 5 });
  });

  it('modifie la durée', () => {
    const scenario = aScenario();

    scenario.changeDuration(2);

    expect(scenario.duration).toBe(2);
  });

  it('ne change pas de MJ (PR-16)', () => {
    const scenario = aScenario();

    scenario.changeContent({ ...details(), title: 'Autre' });

    expect(scenario.gameMasterId).toBe('g1');
  });

  it('se supprime tant qu’il n’a aucune partie (PR-14)', () => {
    const scenario = aScenario();

    expect(() => scenario.remove(aConvention())).not.toThrow();
  });

  it('naît sans image (PR-7)', () => {
    expect(aScenario().imageId).toBeNull();
  });

  it('change d’image, puis la retire, sans règle bloquante (PR-7)', () => {
    const scenario = aScenario();

    scenario.changeImage('i1');
    scenario.changeImage('i2');
    expect(scenario.imageId).toBe('i2');

    scenario.removeImage();
    expect(scenario.imageId).toBeNull();
  });
});
