import type { MergeTimeSlotVerdictDto, MergeVerdictDto } from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { mergeConsequences } from './merge-consequences';

const slot = (
  rank: number,
  verdict: Partial<MergeTimeSlotVerdictDto>,
): MergeTimeSlotVerdictDto => ({
  timeSlotId: `s${rank}`,
  rank,
  assignment: null,
  destinationLeavesDraw: false,
  transferredSignUpTitles: [],
  lostSignUpTitles: [],
  withoutGame: null,
  ...verdict,
});

const buildVerdict = (...timeSlots: MergeTimeSlotVerdictDto[]): MergeVerdictDto => ({ timeSlots });

describe('mergeConsequences', () => {
  it('ne dit que la suppression de la source quand rien ne passe', () => {
    expect(
      mergeConsequences(buildVerdict(slot(1, {})), {
        source: 'Sven',
        destination: 'Lune',
        phones: 0,
      }),
    ).toEqual([`«${NBSP}Sven${NBSP}» sera supprimé, et son pseudo redeviendra libre.`]);
  });

  it('dit, créneau par créneau, l’affectation et les inscriptions qui passent ou se perdent', () => {
    expect(
      mergeConsequences(
        buildVerdict(
          slot(1, {
            assignment: { title: 'Néons', tableName: 'Dragon', outcome: 'transferred' },
            transferredSignUpTitles: ['Néons', 'Brumes'],
            lostSignUpTitles: ['Épice'],
          }),
          slot(2, { destinationLeavesDraw: true, withoutGame: 'lost' }),
          slot(3, {
            assignment: { title: null, tableName: null, outcome: 'lost' },
            transferredSignUpTitles: ['Dune'],
            withoutGame: 'transferred',
          }),
        ),
        { source: 'Sven', destination: 'Lune', phones: 2 },
      ),
    ).toEqual([
      `Créneau 1${NBSP}: «${NBSP}Lune${NBSP}» prend sa place à Néons, table Dragon.`,
      `Créneau 1${NBSP}: ses inscriptions à Néons et Brumes passent à «${NBSP}Lune${NBSP}».`,
      `Créneau 1${NBSP}: son inscription à Épice est perdue.`,
      `Créneau 2${NBSP}: «${NBSP}Lune${NBSP}» quitte le tirage, pour jouer la partie double du créneau d'avant.`,
      `Créneau 2${NBSP}: «${NBSP}Lune${NBSP}» ne devient pas sans partie.`,
      `Créneau 3${NBSP}: sa place de non placé est perdue.`,
      `Créneau 3${NBSP}: son inscription à Dune passe à «${NBSP}Lune${NBSP}».`,
      `Créneau 3${NBSP}: «${NBSP}Lune${NBSP}» devient sans partie, et reste dans le tirage.`,
      `Ses 2${NBSP}téléphones reliés reviendront à l'identification.`,
      `«${NBSP}Sven${NBSP}» sera supprimé, et son pseudo redeviendra libre.`,
    ]);
  });

  it('parle d’une place perdue, d’un non placé repris et d’inscriptions perdues, au pluriel ; et d’un seul téléphone', () => {
    expect(
      mergeConsequences(
        buildVerdict(
          slot(1, {
            assignment: { title: 'Néons', tableName: 'Dragon', outcome: 'lost' },
            lostSignUpTitles: ['Néons', 'Brumes'],
          }),
          slot(2, { assignment: { title: null, tableName: null, outcome: 'transferred' } }),
        ),
        { source: 'Sven', destination: 'Lune', phones: 1 },
      ),
    ).toEqual([
      `Créneau 1${NBSP}: sa place à Néons, table Dragon, est perdue.`,
      `Créneau 1${NBSP}: ses inscriptions à Néons et Brumes sont perdues.`,
      `Créneau 2${NBSP}: «${NBSP}Lune${NBSP}» reprend sa place de non placé dans le tirage.`,
      "Son téléphone relié reviendra à l'identification.",
      `«${NBSP}Sven${NBSP}» sera supprimé, et son pseudo redeviendra libre.`,
    ]);
  });
});
