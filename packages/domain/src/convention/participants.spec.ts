import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Convention } from './convention.js';
import type { LocalMoment } from './local-moment.js';
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

const NOW: LocalMoment = { date: '2027-03-14', time: TimeOfDay.parse('10:00') };

/** Les participants, en « identifiant pseudo ». */
const participantsOf = (convention: Convention) =>
  convention.participants.map((participant) => `${participant.id} ${participant.nickname.text}`);

/** Une convention où « Élodie » s'est déjà identifiée, sous l'identifiant p1. */
function withElodie(): Convention {
  const convention = aConvention();
  convention.identify('p1', 'K7M2', 'Élodie', null, NOW);
  return convention;
}

describe('Identification par un pseudo (ID-1)', () => {
  it('crée un pseudo nouveau, sans les espaces du début et de la fin, et le donne à relier', () => {
    const convention = aConvention();

    const identification = convention.identify('p1', 'K7M2', '  Élodie ', null, NOW);

    expect(identification).toEqual({
      verdict: 'link',
      created: true,
      participant: expect.objectContaining({ id: 'p1' }),
    });
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it('demande une confirmation pour un pseudo existant, sans rien créer', () => {
    const convention = withElodie();

    const identification = convention.identify('p2', 'K7M2', 'Élodie', null, NOW);

    expect(identification).toEqual({
      verdict: 'confirm',
      confirmation: 'participant',
      nickname: 'Élodie',
    });
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it('donne à relier le pseudo existant, une fois confirmé, sans rien créer', () => {
    const convention = withElodie();

    const identification = convention.identify('p2', 'K7M2', 'Élodie', 'participant', NOW);

    expect(identification).toEqual({
      verdict: 'link',
      created: false,
      participant: expect.objectContaining({ id: 'p1' }),
    });
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it('crée un pseudo nouveau même confirmé : la confirmation ne vaut que pour un pseudo existant', () => {
    const convention = aConvention();

    const identification = convention.identify('p1', 'K7M2', 'Élodie', 'participant', NOW);

    expect(identification).toMatchObject({ verdict: 'link', created: true });
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it.each([
    ['la casse', 'élodie'],
    ['les accents', 'Elodie'],
    ['les espaces du début et de la fin', '  ELODIE  '],
  ])('reconnaît le pseudo existant aux différences de %s près (ID-7)', (_, typed) => {
    const convention = withElodie();

    const identification = convention.identify('p2', 'K7M2', typed, null, NOW);

    expect(identification).toEqual({
      verdict: 'confirm',
      confirmation: 'participant',
      nickname: 'Élodie',
    });
  });

  it('reconnaît un pseudo aux espaces à la suite près (ID-7)', () => {
    const convention = aConvention();
    convention.identify('p1', 'K7M2', 'Jean Luc', null, NOW);

    const identification = convention.identify('p2', 'K7M2', 'jean   luc', null, NOW);

    expect(identification).toMatchObject({ verdict: 'confirm', nickname: 'Jean Luc' });
  });

  it('garde la ponctuation : « Jean Luc » est un autre pseudo que « Jean-Luc » (ID-7)', () => {
    const convention = aConvention();
    convention.identify('p1', 'K7M2', 'Jean-Luc', null, NOW);

    const identification = convention.identify('p2', 'K7M2', 'Jean  Luc', null, NOW);

    expect(identification).toMatchObject({ verdict: 'link', created: true });
    expect(participantsOf(convention).toSorted()).toEqual(['p1 Jean-Luc', 'p2 Jean  Luc']);
  });

  it('refuse un pseudo vide', () => {
    const convention = aConvention();

    const refusal = refusalOf(() => convention.identify('p1', 'K7M2', '   ', null, NOW));

    expect(refusal.code).toBe('nickname-required');
    expect(convention.participants).toEqual([]);
  });

  it('accepte un pseudo de 30 caractères, refuse un pseudo de 31', () => {
    const convention = aConvention();

    convention.identify('p1', 'K7M2', 'a'.repeat(30), null, NOW);
    const refusal = refusalOf(() => convention.identify('p2', 'K7M2', 'b'.repeat(31), null, NOW));

    expect(refusal.code).toBe('nickname-too-long');
    expect(refusal.params).toEqual({ max: 30 });
    expect(convention.participants).toHaveLength(1);
  });

  it('refuse un code qui n’est pas le code de présence, sans rien créer (ID-2)', () => {
    const convention = aConvention();

    const refusal = refusalOf(() => convention.identify('p1', 'X9Z9', 'Élodie', null, NOW));

    expect(refusal.code).toBe('presence-code-wrong');
    expect(convention.participants).toEqual([]);
  });

  it('refuse toute identification une fois la convention terminée', () => {
    const convention = aConvention();
    convention.setDate('2027-03-14');
    convention.addTimeSlot('s1', TimeOfDay.parse('09:00'), TimeOfDay.parse('11:30'));

    const refusal = refusalOf(() =>
      convention.identify('p1', 'K7M2', 'Élodie', null, {
        date: '2027-03-14',
        time: TimeOfDay.parse('11:30'),
      }),
    );

    expect(refusal.code).toBe('convention-ended');
    expect(convention.participants).toEqual([]);
  });
});

describe('Identification par le pseudo d’un MJ (ID-3, ID-4)', () => {
  /** Une convention dont « Brann » est MJ, sous l'identifiant g1, avec son participant p-g1. */
  function withGameMasterBrann(): Convention {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Brann');
    return convention;
  }

  it('demande la confirmation « MJ », selon ID-7, sans rien créer', () => {
    const convention = withGameMasterBrann();

    const identification = convention.identify('p1', 'K7M2', ' BRANN ', null, NOW);

    expect(identification).toEqual({
      verdict: 'confirm',
      confirmation: 'game-master',
      nickname: 'Brann',
    });
    expect(participantsOf(convention)).toEqual(['p-g1 Brann']);
  });

  it('donne à relier le participant du MJ avec la confirmation « MJ », sans rien créer', () => {
    const convention = withGameMasterBrann();

    const identification = convention.identify('p1', 'K7M2', 'brann', 'game-master', NOW);

    expect(identification).toEqual({
      verdict: 'link',
      created: false,
      participant: expect.objectContaining({ id: 'p-g1' }),
    });
    expect(participantsOf(convention)).toEqual(['p-g1 Brann']);
  });

  it('redemande la confirmation « MJ » à qui confirme être participant (ID-4)', () => {
    const convention = withGameMasterBrann();

    const identification = convention.identify('p1', 'K7M2', 'Brann', 'participant', NOW);

    expect(identification).toMatchObject({ verdict: 'confirm', confirmation: 'game-master' });
  });

  it('demande la confirmation « participant » à qui confirme être MJ d’un pseudo de participant', () => {
    const convention = withElodie();

    const identification = convention.identify('p2', 'K7M2', 'Élodie', 'game-master', NOW);

    expect(identification).toMatchObject({ verdict: 'confirm', confirmation: 'participant' });
  });
});
