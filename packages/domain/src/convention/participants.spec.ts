import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Convention } from './convention.js';
import { Assignment, Draw } from './draw.js';
import type { LocalMoment } from './local-moment.js';
import { ParticipantWithoutGame } from './participant-without-game.js';
import { PresenceCode } from './presence-code.js';
import { SignUp } from './sign-up.js';
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
    participantsWithoutGame: [],
    draws: [],
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

const NOW: LocalMoment = { date: '2027-03-14', time: TimeOfDay.parse('10:00') };

/** Les participants, en « identifiant pseudo ». */
const participantsOf = (convention: Convention) =>
  convention.participants.map((participant) => `${participant.id} ${participant.nickname.text}`);

/** Une convention où « Élodie » s'est déjà identifiée, sous l'identifiant p1. */
function withElodie(): Convention {
  const convention = aConvention();
  convention.identifyByNickname('p1', 'K7M2', 'Élodie', null, NOW);
  return convention;
}

describe('Identification par un pseudo (ID-1)', () => {
  it('crée un pseudo nouveau, sans les espaces du début et de la fin, et le donne à relier', () => {
    const convention = aConvention();

    const identification = convention.identifyByNickname('p1', 'K7M2', '  Élodie ', null, NOW);

    expect(identification).toEqual({
      verdict: 'link',
      created: true,
      participant: expect.objectContaining({ id: 'p1' }),
    });
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it('demande une confirmation pour un pseudo existant, sans rien créer', () => {
    const convention = withElodie();

    const identification = convention.identifyByNickname('p2', 'K7M2', 'Élodie', null, NOW);

    expect(identification).toEqual({
      verdict: 'confirm',
      confirmation: 'participant',
      nickname: 'Élodie',
    });
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it('donne à relier le pseudo existant, une fois confirmé, sans rien créer', () => {
    const convention = withElodie();

    const identification = convention.identifyByNickname(
      'p2',
      'K7M2',
      'Élodie',
      'participant',
      NOW,
    );

    expect(identification).toEqual({
      verdict: 'link',
      created: false,
      participant: expect.objectContaining({ id: 'p1' }),
    });
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it('crée un pseudo nouveau même confirmé : la confirmation ne vaut que pour un pseudo existant', () => {
    const convention = aConvention();

    const identification = convention.identifyByNickname(
      'p1',
      'K7M2',
      'Élodie',
      'participant',
      NOW,
    );

    expect(identification).toMatchObject({ verdict: 'link', created: true });
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it.each([
    ['la casse', 'élodie'],
    ['les accents', 'Elodie'],
    ['les espaces du début et de la fin', '  ELODIE  '],
  ])('reconnaît le pseudo existant aux différences de %s près (ID-7)', (_, typed) => {
    const convention = withElodie();

    const identification = convention.identifyByNickname('p2', 'K7M2', typed, null, NOW);

    expect(identification).toEqual({
      verdict: 'confirm',
      confirmation: 'participant',
      nickname: 'Élodie',
    });
  });

  it('reconnaît un pseudo aux espaces à la suite près (ID-7)', () => {
    const convention = aConvention();
    convention.identifyByNickname('p1', 'K7M2', 'Jean Luc', null, NOW);

    const identification = convention.identifyByNickname('p2', 'K7M2', 'jean   luc', null, NOW);

    expect(identification).toMatchObject({ verdict: 'confirm', nickname: 'Jean Luc' });
  });

  it('garde la ponctuation : « Jean Luc » est un autre pseudo que « Jean-Luc » (ID-7)', () => {
    const convention = aConvention();
    convention.identifyByNickname('p1', 'K7M2', 'Jean-Luc', null, NOW);

    const identification = convention.identifyByNickname('p2', 'K7M2', 'Jean  Luc', null, NOW);

    expect(identification).toMatchObject({ verdict: 'link', created: true });
    expect(participantsOf(convention).toSorted()).toEqual(['p1 Jean-Luc', 'p2 Jean  Luc']);
  });

  it('refuse un pseudo vide', () => {
    const convention = aConvention();

    const refusal = refusalOf(() => convention.identifyByNickname('p1', 'K7M2', '   ', null, NOW));

    expect(refusal.code).toBe('nickname-required');
    expect(convention.participants).toEqual([]);
  });

  it('accepte un pseudo de 30 caractères, refuse un pseudo de 31', () => {
    const convention = aConvention();

    convention.identifyByNickname('p1', 'K7M2', 'a'.repeat(30), null, NOW);
    const refusal = refusalOf(() =>
      convention.identifyByNickname('p2', 'K7M2', 'b'.repeat(31), null, NOW),
    );

    expect(refusal.code).toBe('nickname-too-long');
    expect(refusal.params).toEqual({ max: 30 });
    expect(convention.participants).toHaveLength(1);
  });

  it('refuse un code qui n’est pas le code de présence, sans rien créer (ID-2)', () => {
    const convention = aConvention();

    const refusal = refusalOf(() =>
      convention.identifyByNickname('p1', 'X9Z9', 'Élodie', null, NOW),
    );

    expect(refusal.code).toBe('presence-code-wrong');
    expect(convention.participants).toEqual([]);
  });

  it('refuse toute identification une fois la convention terminée', () => {
    const convention = aConvention();
    convention.changeDate('2027-03-14');
    convention.addTimeSlot('s1', TimeOfDay.parse('09:00'), TimeOfDay.parse('11:30'));

    const refusal = refusalOf(() =>
      convention.identifyByNickname('p1', 'K7M2', 'Élodie', null, {
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

    const identification = convention.identifyByNickname('p1', 'K7M2', ' BRANN ', null, NOW);

    expect(identification).toEqual({
      verdict: 'confirm',
      confirmation: 'game-master',
      nickname: 'Brann',
    });
    expect(participantsOf(convention)).toEqual(['p-g1 Brann']);
  });

  it('donne à relier le participant du MJ avec la confirmation « MJ », sans rien créer', () => {
    const convention = withGameMasterBrann();

    const identification = convention.identifyByNickname('p1', 'K7M2', 'brann', 'game-master', NOW);

    expect(identification).toEqual({
      verdict: 'link',
      created: false,
      participant: expect.objectContaining({ id: 'p-g1' }),
    });
    expect(participantsOf(convention)).toEqual(['p-g1 Brann']);
  });

  it('redemande la confirmation « MJ » à qui confirme être participant (ID-4)', () => {
    const convention = withGameMasterBrann();

    const identification = convention.identifyByNickname('p1', 'K7M2', 'Brann', 'participant', NOW);

    expect(identification).toMatchObject({ verdict: 'confirm', confirmation: 'game-master' });
  });

  it('demande la confirmation « participant » à qui confirme être MJ d’un pseudo de participant', () => {
    const convention = withElodie();

    const identification = convention.identifyByNickname(
      'p2',
      'K7M2',
      'Élodie',
      'game-master',
      NOW,
    );

    expect(identification).toMatchObject({ verdict: 'confirm', confirmation: 'participant' });
  });
});

describe('Création d’un pseudo par un Organisateur (ID-12)', () => {
  it('crée un pseudo de participant, sans les espaces du début et de la fin', () => {
    const convention = aConvention();

    convention.addParticipant('p1', '  Élodie ');

    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it.each(['elodie', 'ÉLODIE', '  Élodie  '])(
    'refuse « %s » quand le participant « Élodie » existe, avec son identifiant (ID-7)',
    (nickname) => {
      const convention = withElodie();

      const refusal = refusalOf(() => convention.addParticipant('p2', nickname));

      expect(refusal.code).toBe('nickname-taken-by-participant');
      expect(refusal.params).toEqual({ nickname: 'Élodie', participantId: 'p1' });
      expect(participantsOf(convention)).toEqual(['p1 Élodie']);
    },
  );

  it('refuse le pseudo d’un MJ, avec l’identifiant de son participant (ID-4)', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Kaïros');

    const refusal = refusalOf(() => convention.addParticipant('p2', 'kairos'));

    expect(refusal.code).toBe('nickname-taken');
    expect(refusal.params).toEqual({ nickname: 'Kaïros', participantId: 'p-g1' });
    expect(participantsOf(convention)).toEqual(['p-g1 Kaïros']);
  });

  it('garde la ponctuation : « Jean Luc » est un autre pseudo que « Jean-Luc » (ID-7)', () => {
    const convention = aConvention();
    convention.addParticipant('p1', 'Jean-Luc');

    convention.addParticipant('p2', 'Jean Luc');

    expect(participantsOf(convention)).toEqual(['p2 Jean Luc', 'p1 Jean-Luc']);
  });

  it('refuse un pseudo vide, et un pseudo de plus de 30 caractères', () => {
    const convention = aConvention();

    expect(refusalOf(() => convention.addParticipant('p1', '   ')).code).toBe('nickname-required');
    expect(refusalOf(() => convention.addParticipant('p1', 'a'.repeat(31))).params).toEqual({
      max: 30,
    });
    expect(participantsOf(convention)).toEqual([]);
  });

  it('demande ensuite la confirmation de ID-1 au téléphone qui saisit ce pseudo, puis le relie', () => {
    const convention = aConvention();
    convention.addParticipant('p1', 'Élodie');

    const question = convention.identifyByNickname('p2', 'K7M2', 'elodie', null, NOW);
    const link = convention.identifyByNickname('p2', 'K7M2', 'elodie', 'participant', NOW);

    expect(question).toEqual({
      verdict: 'confirm',
      confirmation: 'participant',
      nickname: 'Élodie',
    });
    expect(link).toEqual({
      verdict: 'link',
      created: false,
      participant: expect.objectContaining({ id: 'p1' }),
    });
  });
});

describe('Renommer un pseudo (ID-13)', () => {
  it('renomme un participant, qui garde son identifiant', () => {
    const convention = withElodie();

    convention.renameParticipant('p1', '  Céleste ');

    expect(participantsOf(convention)).toEqual(['p1 Céleste']);
  });

  it('libère l’ancien nom : qui le saisit ensuite crée un nouveau pseudo (ID-1)', () => {
    const convention = withElodie();
    convention.renameParticipant('p1', 'Céleste');

    const identification = convention.identifyByNickname('p2', 'K7M2', 'élodie', null, NOW);

    expect(identification).toMatchObject({ verdict: 'link', created: true });
  });

  it.each(['elodie', 'ÉLODIE', 'Élodie  '])(
    'accepte de corriger la casse, les accents ou les espaces du même pseudo : « %s » (ID-7)',
    (nickname) => {
      const convention = withElodie();

      convention.renameParticipant('p1', nickname);

      expect(participantsOf(convention)).toEqual([`p1 ${nickname.trim()}`]);
    },
  );

  it('refuse le pseudo d’un autre participant, avec son identifiant', () => {
    const convention = withElodie();
    convention.addParticipant('p2', 'Lune');

    const refusal = refusalOf(() => convention.renameParticipant('p2', 'elodie'));

    expect(refusal.code).toBe('nickname-taken-by-participant');
    expect(refusal.params).toEqual({ nickname: 'Élodie', participantId: 'p1' });
    expect(participantsOf(convention)).toEqual(['p1 Élodie', 'p2 Lune']);
  });

  it('refuse le pseudo d’un MJ, avec l’identifiant de son participant (ID-4)', () => {
    const convention = withElodie();
    convention.addGameMaster('g1', 'p-g1', 'Kaïros');

    const refusal = refusalOf(() => convention.renameParticipant('p1', 'KAIROS'));

    expect(refusal.code).toBe('nickname-taken');
    expect(refusal.params).toEqual({ nickname: 'Kaïros', participantId: 'p-g1' });
  });

  it('refuse un pseudo vide, et un pseudo de plus de 30 caractères', () => {
    const convention = withElodie();

    expect(refusalOf(() => convention.renameParticipant('p1', '  ')).code).toBe(
      'nickname-required',
    );
    expect(refusalOf(() => convention.renameParticipant('p1', 'a'.repeat(31))).code).toBe(
      'nickname-too-long',
    );
    expect(participantsOf(convention)).toEqual(['p1 Élodie']);
  });

  it('refuse de renommer un participant inconnu', () => {
    expect(refusalOf(() => aConvention().renameParticipant('x', 'Alix')).code).toBe(
      'participant-not-found',
    );
  });

  it('renomme le pseudo d’un MJ, qui reste le sien (ADR 0012)', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Kaïros');

    convention.renameParticipant('p-g1', 'Brann');

    expect(convention.gameMasters.map((gameMaster) => gameMaster.nickname.text)).toEqual(['Brann']);
    expect(participantsOf(convention)).toEqual(['p-g1 Brann']);
  });

  it('garde au MJ ses disponibilités', () => {
    const convention = aConvention();
    convention.addTimeSlot('s1', TimeOfDay.parse('09:00'), TimeOfDay.parse('11:30'));
    convention.addGameMaster('g1', 'p-g1', 'Kaïros');
    convention.declareGameMasterAvailability('g1', 's1');

    convention.renameParticipant('p-g1', 'Brann');

    expect(convention.gameMasters[0]?.isAvailableOnTimeSlot('s1')).toBe(true);
  });

  it('renomme après la publication d’un tirage, sans toucher à ses inscriptions ni à ses affectations (TI-7)', () => {
    const convention = withElodie();
    convention.addTimeSlot('s1', TimeOfDay.parse('09:00'), TimeOfDay.parse('11:30'));
    const published = Convention.restore({
      id: convention.id,
      name: convention.name,
      date: convention.date,
      timeSlots: [...convention.timeSlots],
      tables: [],
      gameMasters: [],
      participants: [...convention.participants],
      signUps: [new SignUp('p1', 'brumes')],
      participantsWithoutGame: [],
      draws: [new Draw('s1', true, [new Assignment('p1', null, false)])],
      games: [],
      version: convention.version,
      presenceCode: convention.presenceCode,
    });

    published.renameParticipant('p1', 'Céleste');

    expect(participantsOf(published)).toEqual(['p1 Céleste']);
    expect(published.signUps).toEqual([new SignUp('p1', 'brumes')]);
    expect(published.draws[0]?.assignments).toEqual([new Assignment('p1', null, false)]);
  });
});

describe('Supprimer un pseudo (ID-10)', () => {
  /**
   * Élodie (p1) et Lune (p2), inscrites à « brumes » au créneau 1 ; Élodie, sans partie au créneau 2.
   * Le tirage du créneau 1 est publié, celui du créneau 2 est provisoire.
   */
  function buildConventionWithTwoDraws(): Convention {
    const convention = withElodie();
    convention.addParticipant('p2', 'Lune');
    return Convention.restore({
      id: convention.id,
      name: convention.name,
      date: convention.date,
      timeSlots: [],
      tables: [],
      gameMasters: [],
      participants: [...convention.participants],
      signUps: [new SignUp('p1', 'brumes'), new SignUp('p2', 'brumes')],
      participantsWithoutGame: [new ParticipantWithoutGame('p1', 's2')],
      draws: [
        new Draw('s1', true, [
          new Assignment('p1', 'brumes', false),
          new Assignment('p2', 'brumes', true),
        ]),
        new Draw('s2', false, [
          new Assignment('p1', null, false),
          new Assignment('p2', null, false),
        ]),
      ],
      games: [],
      version: convention.version,
      presenceCode: convention.presenceCode,
    });
  }

  it('retire le pseudo, ses inscriptions, son état sans partie et ses résultats, même après la publication', () => {
    const convention = buildConventionWithTwoDraws();

    convention.removeParticipant('p1');

    expect(participantsOf(convention)).toEqual(['p2 Lune']);
    expect(convention.signUps).toEqual([new SignUp('p2', 'brumes')]);
    expect(convention.participantsWithoutGame).toEqual([]);
    expect(convention.draws).toEqual([
      new Draw('s1', true, [new Assignment('p2', 'brumes', true)]),
      new Draw('s2', false, [new Assignment('p2', null, false)]),
    ]);
  });

  it('libère le pseudo : qui le saisit ensuite crée un nouveau pseudo (ID-1)', () => {
    const convention = withElodie();
    convention.removeParticipant('p1');

    const identification = convention.identifyByNickname('p2', 'K7M2', 'Élodie', null, NOW);

    expect(identification).toMatchObject({ verdict: 'link', created: true });
  });

  it('refuse de supprimer un MJ, qui se supprime par sa fiche de MJ (PR-12)', () => {
    const convention = aConvention();
    convention.addGameMaster('g1', 'p-g1', 'Kaïros');

    const refusal = refusalOf(() => convention.removeParticipant('p-g1'));

    expect(refusal.code).toBe('participant-is-game-master');
    expect(participantsOf(convention)).toEqual(['p-g1 Kaïros']);
    expect(convention.gameMasters).toHaveLength(1);
  });

  it('refuse de supprimer un participant inconnu', () => {
    expect(refusalOf(() => aConvention().removeParticipant('x')).code).toBe(
      'participant-not-found',
    );
  });
});
