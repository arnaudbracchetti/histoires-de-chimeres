import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { ScenarioCatalogue } from '../scenario/scenario-catalogue.js';
import { Convention } from './convention.js';
import { PresenceCode } from './presence-code.js';
import { TimeOfDay } from './time-of-day.js';

function aConvention(): Convention {
  return Convention.restore({
    id: 'c1',
    name: 'Histoires de Chimères',
    date: null,
    timeSlots: [],
    tables: [],
    gameMasters: [],
    participants: [],
    signUps: [],
    games: [],
    version: 0,
    presenceCode: PresenceCode.parse('K7M2'),
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

    convention.addGameMaster('g1', 'p-g1', '  Élodie ');

    expect(gameMastersOf(convention)).toEqual(['g1 Élodie']);
  });

  it.each(['elodie', 'ÉLODIE', 'Elodie', '  Élodie  '])(
    'refuse « %s » quand « Élodie » existe : même pseudo (ID-7)',
    (nickname) => {
      const convention = aConvention();
      convention.addGameMaster('g1', 'p-g1', 'Élodie');

      const refusal = refusalOf(() => convention.addGameMaster('g2', 'p-g2', nickname));

      expect(refusal.code).toBe('nickname-taken');
      expect(refusal.params).toEqual({ nickname: 'Élodie' });
      expect(gameMastersOf(convention)).toEqual(['g1 Élodie']);
    },
  );

  it('accepte « Jean Luc » à côté de « Jean-Luc » : la ponctuation compte (ID-7)', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Jean-Luc');

    convention.addGameMaster('g2', 'p-g2', 'Jean Luc');

    expect(gameMastersOf(convention)).toEqual(['g2 Jean Luc', 'g1 Jean-Luc']);
  });

  it.each([
    ['vide', '   ', 'nickname-required', {}],
    ['de 31 caractères', 'a'.repeat(31), 'nickname-too-long', { max: 30 }],
  ])('refuse un pseudo %s', (_, nickname, code, params) => {
    const refusal = refusalOf(() => aConvention().addGameMaster('g1', 'p-g1', nickname));

    expect(refusal.code).toBe(code);
    expect(refusal.params).toEqual(params);
  });

  it('accepte un pseudo de 30 caractères', () => {
    const convention = aConvention();

    convention.addGameMaster('g1', 'p-g1', 'a'.repeat(30));

    expect(convention.gameMasters).toHaveLength(1);
  });

  it('change le pseudo d’un MJ, qui reprend sa place dans l’ordre naturel', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Alix');
    convention.addGameMaster('g2', 'p-g2', 'Brune');

    convention.changeGameMasterNickname('g1', 'Céleste');

    expect(gameMastersOf(convention)).toEqual(['g2 Brune', 'g1 Céleste']);
  });

  it('accepte que le MJ garde son pseudo, autrement écrit', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Élodie');

    convention.changeGameMasterNickname('g1', 'elodie');

    expect(gameMastersOf(convention)).toEqual(['g1 elodie']);
  });

  it('refuse le pseudo d’un autre MJ', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Élodie');
    convention.addGameMaster('g2', 'p-g2', 'Kaïros');

    const refusal = refusalOf(() => convention.changeGameMasterNickname('g2', 'ELODIE'));

    expect(refusal.code).toBe('nickname-taken');
    expect(gameMastersOf(convention)).toEqual(['g1 Élodie', 'g2 Kaïros']);
  });

  describe('son participant (ADR 0012)', () => {
    /** Les participants, en « identifiant pseudo ». */
    const participantsOf = (convention: Convention) =>
      convention.participants.map(
        (participant) => `${participant.id} ${participant.nickname.text}`,
      );

    it('crée le participant du MJ, sous le même pseudo', () => {
      const convention = aConvention();

      convention.addGameMaster('g1', 'p-g1', 'Élodie');

      expect(participantsOf(convention)).toEqual(['p-g1 Élodie']);
    });

    it('renomme son participant avec lui, qui garde son identifiant', () => {
      const convention = aConvention();
      convention.addGameMaster('g1', 'p-g1', 'Élodie');

      convention.changeGameMasterNickname('g1', 'Céleste');

      expect(participantsOf(convention)).toEqual(['p-g1 Céleste']);
    });

    it('supprime son participant avec lui', () => {
      const convention = aConvention();
      convention.addGameMaster('g1', 'p-g1', 'Élodie');

      convention.removeGameMaster('g1', ScenarioCatalogue.restore([]));

      expect(convention.participants).toEqual([]);
    });
  });

  describe('pseudo déjà pris par un participant : un seul ensemble de pseudos (PR-12, ID-4)', () => {
    /** Une convention où le participant « Élodie » s'est identifié. */
    function withParticipantElodie(): Convention {
      const convention = aConvention();
      convention.identifyByNickname('p1', 'K7M2', 'Élodie', null, {
        date: '2027-03-14',
        time: TimeOfDay.parse('10:00'),
      });
      return convention;
    }

    it('refuse de créer un MJ sous ce pseudo, selon ID-7', () => {
      const convention = withParticipantElodie();

      const refusal = refusalOf(() => convention.addGameMaster('g1', 'p-g1', 'ELODIE'));

      expect(refusal.code).toBe('nickname-taken-by-participant');
      expect(refusal.params).toEqual({ nickname: 'Élodie' });
      expect(convention.gameMasters).toEqual([]);
    });

    it('refuse de renommer un MJ sous ce pseudo', () => {
      const convention = withParticipantElodie();
      convention.addGameMaster('g1', 'p-g1', 'Kaïros');

      const refusal = refusalOf(() => convention.changeGameMasterNickname('g1', 'elodie'));

      expect(refusal.code).toBe('nickname-taken-by-participant');
      expect(gameMastersOf(convention)).toEqual(['g1 Kaïros']);
    });
  });

  it('supprime un MJ sans scénario, même si un autre MJ en a', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Élodie');
    convention.addGameMaster('g2', 'p-g2', 'Kaïros');
    const catalogue = ScenarioCatalogue.restore([
      { id: 's1', gameMasterId: 'g2', duration: 1, maxSeats: 5 },
    ]);

    convention.removeGameMaster('g1', catalogue);

    expect(gameMastersOf(convention)).toEqual(['g2 Kaïros']);
  });

  it('refuse de supprimer un MJ qui a des scénarios, avec leur nombre (PR-12)', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Élodie');
    const catalogue = ScenarioCatalogue.restore([
      { id: 's1', gameMasterId: 'g1', duration: 1, maxSeats: 5 },
      { id: 's2', gameMasterId: 'g1', duration: 1, maxSeats: 5 },
    ]);

    const refusal = refusalOf(() => convention.removeGameMaster('g1', catalogue));

    expect(refusal.code).toBe('game-master-has-scenarios');
    expect(refusal.params).toEqual({ scenarios: 2 });
    expect(gameMastersOf(convention)).toEqual(['g1 Élodie']);
  });

  it.each([
    [
      'changer le pseudo d’un',
      (convention: Convention) => convention.changeGameMasterNickname('x', 'Alix'),
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
