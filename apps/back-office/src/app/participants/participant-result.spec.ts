import { NBSP } from '@chimeres/design';
import { describeParticipantResult } from './participant-result';

describe('describeParticipantResult', () => {
  it('donne sa table au pseudo placé, puis la partie et son MJ', () => {
    expect(
      describeParticipantResult({
        kind: 'assigned',
        tableName: 'Dragon',
        title: 'Néons',
        gameMasterNickname: 'Élodie',
      }),
    ).toEqual({ main: 'Table Dragon', detail: 'Néons, avec Élodie', tone: null });
  });

  it('dit au non placé où il reste de la place, et combien', () => {
    expect(
      describeParticipantResult({
        kind: 'unassigned',
        tablesWithSeats: [
          { tableName: 'T1', freeSeatCount: 3 },
          { tableName: 'T2', freeSeatCount: 1 },
        ],
      }),
    ).toEqual({
      main: 'Non placé',
      detail: 'Il reste de la place à T1 (3), T2 (1).',
      tone: 'danger',
    });
  });

  it('dit au non placé que tout est complet', () => {
    expect(describeParticipantResult({ kind: 'unassigned', tablesWithSeats: [] }).detail).toBe(
      'Toutes les parties du créneau sont complètes.',
    );
  });

  it('donne au MJ la partie qu’il mène et sa table', () => {
    expect(
      describeParticipantResult({ kind: 'leading', title: 'Néons', tableName: 'Dragon' }),
    ).toEqual({ main: 'Mène Néons', detail: 'Table Dragon', tone: null });
  });

  it('dit « Pas dans le tirage »', () => {
    expect(describeParticipantResult({ kind: 'not-in-draw' })).toEqual({
      main: 'Pas dans le tirage',
      detail: null,
      tone: null,
    });
  });

  it('compte ses inscriptions sur un créneau ouvert', () => {
    expect(describeParticipantResult({ kind: 'signed-up', signUpCount: 2 })).toEqual({
      main: `2${NBSP}inscriptions`,
      detail: null,
      tone: null,
    });
    expect(describeParticipantResult({ kind: 'signed-up', signUpCount: 0 })).toEqual({
      main: 'Aucune inscription',
      detail: null,
      tone: 'muted',
    });
  });
});
