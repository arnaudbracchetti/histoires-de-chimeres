import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Convention } from './convention.js';
import { PresenceCode } from './presence-code.js';

function aConvention(): Convention {
  return Convention.restore({
    id: 'c1',
    name: 'Histoires de Chimères',
    date: null,
    timeSlots: [],
    tables: [],
    gameMasters: [],
    games: [],
    version: 0,
    presenceCode: PresenceCode.of('K7M2'),
  });
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

/** Les MJ dans l'ordre affiché, en « identifiant pseudo ». */
const gameMastersOf = (convention: Convention) =>
  convention.gameMasters.map((gameMaster) => `${gameMaster.id} ${gameMaster.nickname.text}`);

describe('MJ de la convention', () => {
  it('crée un MJ, avec le pseudo saisi sans les espaces du début et de la fin', () => {
    const convention = aConvention();

    convention.addGameMaster('g1', '  Élodie ');

    expect(gameMastersOf(convention)).toEqual(['g1 Élodie']);
  });

  it.each(['elodie', 'ÉLODIE', 'Elodie', '  Élodie  '])(
    'refuse « %s » quand « Élodie » existe : même pseudo (ID-7)',
    (nickname) => {
      const convention = aConvention();
      convention.addGameMaster('g1', 'Élodie');

      const refusal = refusalOf(() => convention.addGameMaster('g2', nickname));

      expect(refusal.code).toBe('nickname-taken');
      expect(refusal.params).toEqual({ nickname: 'Élodie' });
      expect(gameMastersOf(convention)).toEqual(['g1 Élodie']);
    },
  );

  it('accepte « Jean Luc » à côté de « Jean-Luc » : la ponctuation compte (ID-7)', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'Jean-Luc');

    convention.addGameMaster('g2', 'Jean Luc');

    expect(gameMastersOf(convention)).toEqual(['g2 Jean Luc', 'g1 Jean-Luc']);
  });

  it.each([
    ['vide', '   ', 'nickname-required', {}],
    ['de 31 caractères', 'a'.repeat(31), 'nickname-too-long', { max: 30 }],
  ])('refuse un pseudo %s', (_, nickname, code, params) => {
    const refusal = refusalOf(() => aConvention().addGameMaster('g1', nickname));

    expect(refusal.code).toBe(code);
    expect(refusal.params).toEqual(params);
  });

  it('accepte un pseudo de 30 caractères', () => {
    const convention = aConvention();

    convention.addGameMaster('g1', 'a'.repeat(30));

    expect(convention.gameMasters).toHaveLength(1);
  });

  it('change le pseudo d’un MJ, qui reprend sa place dans l’ordre naturel', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'Alix');
    convention.addGameMaster('g2', 'Brune');

    convention.renameGameMaster('g1', 'Céleste');

    expect(gameMastersOf(convention)).toEqual(['g2 Brune', 'g1 Céleste']);
  });

  it('accepte que le MJ garde son pseudo, autrement écrit', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'Élodie');

    convention.renameGameMaster('g1', 'elodie');

    expect(gameMastersOf(convention)).toEqual(['g1 elodie']);
  });

  it('refuse le pseudo d’un autre MJ', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'Élodie');
    convention.addGameMaster('g2', 'Kaïros');

    const refusal = refusalOf(() => convention.renameGameMaster('g2', 'ELODIE'));

    expect(refusal.code).toBe('nickname-taken');
    expect(gameMastersOf(convention)).toEqual(['g1 Élodie', 'g2 Kaïros']);
  });

  it('supprime un MJ sans scénario, même si un autre MJ en a', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'Élodie');
    convention.addGameMaster('g2', 'Kaïros');
    const catalogue = ScenarioCatalogue.restore([{ id: 's1', gameMasterId: 'g2', duration: 1 }]);

    convention.removeGameMaster('g1', catalogue);

    expect(gameMastersOf(convention)).toEqual(['g2 Kaïros']);
  });

  it('refuse de supprimer un MJ qui a des scénarios, avec leur nombre (PR-12)', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'Élodie');
    const catalogue = ScenarioCatalogue.restore([
      { id: 's1', gameMasterId: 'g1', duration: 1 },
      { id: 's2', gameMasterId: 'g1', duration: 1 },
    ]);

    const refusal = refusalOf(() => convention.removeGameMaster('g1', catalogue));

    expect(refusal.code).toBe('game-master-has-scenarios');
    expect(refusal.params).toEqual({ scenarios: 2 });
    expect(gameMastersOf(convention)).toEqual(['g1 Élodie']);
  });

  it.each([
    [
      'changer le pseudo d’un',
      (convention: Convention) => convention.renameGameMaster('x', 'Alix'),
    ],
    [
      'supprimer un',
      (convention: Convention) => convention.removeGameMaster('x', ScenarioCatalogue.restore([])),
    ],
  ])('refuse de %s MJ inconnu', (_, action) => {
    const convention = aConvention();

    expect(refusalOf(() => action(convention)).code).toBe('game-master-not-found');
  });
});
