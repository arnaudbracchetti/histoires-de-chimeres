import { describe, expect, it } from 'vitest';
import { Refusal } from '../refusal.js';
import { Scenario, type Duration } from '../scenario/scenario.js';
import { Convention } from './convention.js';
import { Assignment, Draw } from './draw.js';
import type { LocalMoment } from './local-moment.js';
import { ParticipantWithoutGame } from './participant-without-game.js';
import { PresenceCode } from './presence-code.js';
import { SignUp } from './sign-up.js';
import { TimeOfDay } from './time-of-day.js';

// La fusion de deux pseudos (ID-11), à travers `Convention` : son interface est la surface de test.

const at = TimeOfDay.parse;
const NOW: LocalMoment = { date: '2027-03-14', time: at('08:00') };

function aScenario(id: string, gameMasterId: string, duration: Duration = 1): Scenario {
  return Scenario.propose(id, gameMasterId, {
    title: `Scénario ${id}`,
    system: 'Cthulhu',
    presentation: 'Une enquête.',
    contentWarnings: '',
    seats: { min: 3, max: 5 },
    duration,
  });
}

/**
 * Créneaux s1 et s2, tables t1 et t2. Au créneau 1 : « brumes » (t1, Brann) et « épice », partie
 * double des créneaux 1 et 2 (t2, Kaïros). Au créneau 2 : « néons » (t1, Brann). Les participants
 * « Élodie » (p1), la source, et « Lune » (p2), la destination, se sont identifiés.
 */
function aConvention(): Convention {
  const convention = Convention.restore({
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
  convention.addTimeSlot('s1', at('09:00'), at('11:30'));
  convention.addTimeSlot('s2', at('14:00'), at('16:30'));
  convention.addTable('t1', 'Table 1');
  convention.addTable('t2', 'Table 2');
  convention.addGameMaster('g1', 'p-g1', 'Brann');
  convention.addGameMaster('g2', 'p-g2', 'Kaïros');
  for (const gameMasterId of ['g1', 'g2']) {
    convention.declareGameMasterAvailability(gameMasterId, 's1');
    convention.declareGameMasterAvailability(gameMasterId, 's2');
  }
  convention.scheduleScenario('brumes', aScenario('a', 'g1'), 's1', 't1');
  convention.scheduleScenario('epice', aScenario('b', 'g2', 2), 's1', 't2');
  convention.scheduleScenario('neons', aScenario('c', 'g1'), 's2', 't1');
  convention.identifyByNickname('p1', 'K7M2', 'Élodie', null, NOW);
  convention.identifyByNickname('p2', 'K7M2', 'Lune', null, NOW);
  return convention;
}

/** La convention de `aConvention()`, avec ces inscriptions, ces états sans partie et ces tirages. */
function withState(state: {
  signUps?: SignUp[];
  participantsWithoutGame?: ParticipantWithoutGame[];
  draws?: Draw[];
}): Convention {
  const convention = aConvention();
  return Convention.restore({
    id: convention.id,
    name: convention.name,
    date: convention.date,
    timeSlots: [...convention.timeSlots],
    tables: [...convention.tables],
    gameMasters: [...convention.gameMasters],
    participants: [...convention.participants],
    signUps: state.signUps ?? [],
    participantsWithoutGame: state.participantsWithoutGame ?? [],
    draws: state.draws ?? [],
    games: [...convention.games],
    version: convention.version,
    presenceCode: convention.presenceCode,
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

/** Les participants, en « identifiant pseudo ». */
const participantsOf = (convention: Convention) =>
  convention.participants.map((participant) => `${participant.id} ${participant.nickname.text}`);

/** Les inscriptions, en « participant partie ». */
const signUpsOf = (convention: Convention) =>
  convention.signUps.map(({ participantId, gameId }) => `${participantId} ${gameId}`);

/** Le tirage du créneau. */
const drawOf = (convention: Convention, timeSlotId: string) =>
  convention.draws.find((draw) => draw.timeSlotId === timeSlotId);

describe('Fusionner deux pseudos (ID-11)', () => {
  describe('refus', () => {
    it('refuse une source ou une destination inconnue', () => {
      expect(refusalOf(() => aConvention().mergeParticipant('x', 'p2')).code).toBe(
        'participant-not-found',
      );
      expect(refusalOf(() => aConvention().mergeParticipant('p1', 'x')).code).toBe(
        'participant-not-found',
      );
    });

    it('refuse de fusionner un pseudo dans lui-même', () => {
      const refusal = refusalOf(() => aConvention().mergeParticipant('p1', 'p1'));

      expect(refusal.code).toBe('merge-into-itself');
    });

    it('refuse une source MJ, qui se gère depuis sa fiche de MJ (PR-12)', () => {
      const convention = aConvention();

      const refusal = refusalOf(() => convention.mergeParticipant('p-g1', 'p2'));

      expect(refusal).toMatchObject({
        code: 'participant-is-game-master',
        params: { nickname: 'Brann' },
      });
      expect(participantsOf(convention)).toContain('p-g1 Brann');
    });
  });

  it('supprime la source et passe ses inscriptions à la destination, sans doublon par partie, à la suite des autres', () => {
    const convention = withState({
      signUps: [new SignUp('p1', 'brumes'), new SignUp('p1', 'epice'), new SignUp('p2', 'brumes')],
    });

    convention.mergeParticipant('p1', 'p2');

    expect(participantsOf(convention)).toEqual(['p-g1 Brann', 'p-g2 Kaïros', 'p2 Lune']);
    expect(signUpsOf(convention)).toEqual(['p2 brumes', 'p2 epice']);
  });

  describe('tirages', () => {
    it('destination placée : la source perd son affectation et ses inscriptions du créneau', () => {
      const convention = withState({
        signUps: [new SignUp('p1', 'epice'), new SignUp('p1', 'neons'), new SignUp('p2', 'brumes')],
        draws: [
          new Draw('s1', false, [
            new Assignment('p1', 'epice', false),
            new Assignment('p2', 'brumes', false),
          ]),
        ],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(drawOf(convention, 's1')?.assignments).toEqual([
        new Assignment('p2', 'brumes', false),
      ]);
      expect(signUpsOf(convention)).toEqual(['p2 brumes', 'p2 neons']);
    });

    it('source placée, destination non placée : la destination reprend l’affectation entière, marque « déplacé à la main » comprise', () => {
      const convention = withState({
        draws: [
          new Draw('s1', true, [
            new Assignment('p2', null, false),
            new Assignment('p1', 'brumes', true),
          ]),
        ],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(drawOf(convention, 's1')?.assignments).toEqual([new Assignment('p2', 'brumes', true)]);
    });

    it('destination absente du tirage : l’affectation de la source passe à la destination', () => {
      const convention = withState({
        draws: [
          new Draw('s1', true, [
            new Assignment('p1', null, true),
            new Assignment('p-g1', 'epice', false),
          ]),
        ],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(drawOf(convention, 's1')?.assignments).toEqual([
        new Assignment('p2', null, true),
        new Assignment('p-g1', 'epice', false),
      ]);
    });

    it('toutes deux non placées : une seule affectation reste, celle de la destination', () => {
      const convention = withState({
        draws: [
          new Draw('s1', false, [
            new Assignment('p1', null, true),
            new Assignment('p2', null, false),
          ]),
        ],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(drawOf(convention, 's1')?.assignments).toEqual([new Assignment('p2', null, false)]);
    });

    it('partie double : la source placée dans « épice » la perd si la destination est placée au second créneau', () => {
      const convention = withState({
        draws: [
          new Draw('s1', true, [new Assignment('p1', 'epice', false)]),
          new Draw('s2', false, [new Assignment('p2', 'neons', false)]),
        ],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(convention.draws).toEqual([
        new Draw('s1', true, []),
        new Draw('s2', false, [new Assignment('p2', 'neons', false)]),
      ]);
    });

    it('partie double : la destination non placée au second créneau prend « épice » et quitte le tirage du second créneau (TI-3)', () => {
      const convention = withState({
        draws: [
          new Draw('s1', true, [new Assignment('p1', 'epice', false)]),
          new Draw('s2', false, [
            new Assignment('p2', null, false),
            new Assignment('p-g2', null, false),
          ]),
        ],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(convention.draws).toEqual([
        new Draw('s1', true, [new Assignment('p2', 'epice', false)]),
        new Draw('s2', false, [new Assignment('p-g2', null, false)]),
      ]);
    });

    it('destination placée dans une partie double qui se poursuit sur le créneau : la source y perd son affectation', () => {
      const convention = withState({
        draws: [
          new Draw('s1', true, [new Assignment('p2', 'epice', false)]),
          new Draw('s2', false, [new Assignment('p1', 'neons', false)]),
        ],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(drawOf(convention, 's2')?.assignments).toEqual([]);
    });
  });

  describe('destination MJ (IN-4)', () => {
    it('qui mène sur le créneau : résultat de la source perdu, inscriptions passées en secours, sauf celle à sa propre partie, perdue', () => {
      // Brann (p-g1) mène « brumes » au créneau 1.
      const convention = withState({
        signUps: [new SignUp('p1', 'brumes'), new SignUp('p1', 'epice')],
        draws: [new Draw('s1', false, [new Assignment('p1', 'epice', false)])],
      });

      convention.mergeParticipant('p1', 'p-g1');

      expect(signUpsOf(convention)).toEqual(['p-g1 epice']);
      expect(drawOf(convention, 's1')?.assignments).toEqual([]);
      expect(convention.computeParticipantSituation('p-g1', NOW).backupGameIds).toEqual(['epice']);
    });

    it('dont la partie est annulée (TI-6) : il n’y mène plus, la destination reprend l’affectation de la source', () => {
      const convention = withState({
        draws: [
          new Draw(
            's1',
            false,
            [new Assignment('p1', 'brumes', false), new Assignment('p-g2', null, false)],
            ['epice'],
          ),
        ],
      });

      convention.mergeParticipant('p1', 'p-g2');

      expect(drawOf(convention, 's1')?.assignments).toEqual([
        new Assignment('p-g2', 'brumes', false),
      ]);
    });
  });

  describe('état sans partie (IN-6)', () => {
    it('passe à la destination sans inscription active sur le créneau', () => {
      const convention = withState({
        signUps: [new SignUp('p2', 'brumes')],
        participantsWithoutGame: [new ParticipantWithoutGame('p1', 's2')],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(convention.participantsWithoutGame).toEqual([new ParticipantWithoutGame('p2', 's2')]);
    });

    it('se perd si la destination a une inscription active sur le créneau', () => {
      const convention = withState({
        signUps: [new SignUp('p2', 'neons')],
        participantsWithoutGame: [new ParticipantWithoutGame('p1', 's2')],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(convention.participantsWithoutGame).toEqual([]);
    });

    it('se perd si la destination mène sur le créneau', () => {
      const convention = withState({
        participantsWithoutGame: [new ParticipantWithoutGame('p1', 's2')],
      });

      convention.mergeParticipant('p1', 'p-g1');

      expect(convention.participantsWithoutGame).toEqual([]);
    });

    it('n’est pas en double si la destination l’a déjà', () => {
      const convention = withState({
        participantsWithoutGame: [
          new ParticipantWithoutGame('p1', 's2'),
          new ParticipantWithoutGame('p2', 's2'),
        ],
      });

      convention.mergeParticipant('p1', 'p2');

      expect(convention.participantsWithoutGame).toEqual([new ParticipantWithoutGame('p2', 's2')]);
    });
  });

  describe('ce que la fusion fera', () => {
    it('annonce, créneau par créneau, exactement l’effet de la fusion, sans rien changer', () => {
      // Créneau 1 publié : Élodie placée dans « épice », partie double ; Lune non placée.
      // Créneau 2 provisoire : Lune non placée, elle le quitte en prenant « épice ».
      // Élodie est inscrite à « épice » (Lune aussi), à « brumes » et à « néons ».
      const convention = withState({
        signUps: [
          new SignUp('p1', 'epice'),
          new SignUp('p1', 'brumes'),
          new SignUp('p1', 'neons'),
          new SignUp('p2', 'epice'),
        ],
        draws: [
          new Draw('s1', true, [
            new Assignment('p1', 'epice', true),
            new Assignment('p2', null, false),
          ]),
          new Draw('s2', false, [new Assignment('p2', null, false)]),
        ],
      });
      const before = convention.version;

      const verdict = convention.computeMergeVerdict('p1', 'p2');

      expect(verdict).toEqual([
        {
          timeSlotId: 's1',
          assignment: { gameId: 'epice', outcome: 'transferred' },
          destinationLeavesDraw: false,
          transferredSignUpGameIds: ['brumes'],
          lostSignUpGameIds: [],
          withoutGame: null,
        },
        {
          timeSlotId: 's2',
          assignment: null,
          destinationLeavesDraw: true,
          transferredSignUpGameIds: ['neons'],
          lostSignUpGameIds: [],
          withoutGame: null,
        },
      ]);
      expect(participantsOf(convention)).toContain('p1 Élodie');
      expect(convention.version).toBe(before);

      convention.mergeParticipant('p1', 'p2');

      expect(convention.draws).toEqual([
        new Draw('s1', true, [new Assignment('p2', 'epice', true)]),
        new Draw('s2', false, []),
      ]);
      expect(signUpsOf(convention)).toEqual(['p2 epice', 'p2 brumes', 'p2 neons']);
    });

    it('annonce les pertes : affectation, inscriptions et état sans partie', () => {
      // Brann (p-g1) mène « brumes » au créneau 1 et « néons » au créneau 2.
      const convention = withState({
        signUps: [new SignUp('p1', 'brumes'), new SignUp('p1', 'epice')],
        participantsWithoutGame: [new ParticipantWithoutGame('p1', 's2')],
        draws: [new Draw('s1', false, [new Assignment('p1', null, false)])],
      });

      const verdict = convention.computeMergeVerdict('p1', 'p-g1');

      expect(verdict).toEqual([
        {
          timeSlotId: 's1',
          assignment: { gameId: null, outcome: 'lost' },
          destinationLeavesDraw: false,
          transferredSignUpGameIds: ['epice'],
          lostSignUpGameIds: ['brumes'],
          withoutGame: null,
        },
        {
          timeSlotId: 's2',
          assignment: null,
          destinationLeavesDraw: false,
          transferredSignUpGameIds: [],
          lostSignUpGameIds: [],
          withoutGame: 'lost',
        },
      ]);

      convention.mergeParticipant('p1', 'p-g1');

      expect(convention.draws).toEqual([new Draw('s1', false, [])]);
      expect(signUpsOf(convention)).toEqual(['p-g1 epice']);
      expect(convention.participantsWithoutGame).toEqual([]);
    });

    it('refuse comme la fusion', () => {
      expect(refusalOf(() => aConvention().computeMergeVerdict('p1', 'p1')).code).toBe(
        'merge-into-itself',
      );
    });
  });
});
