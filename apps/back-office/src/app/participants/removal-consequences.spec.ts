import type { ParticipantSheetDto, ParticipantTimeSlotDto } from '@chimeres/contract';
import { NBSP } from '@chimeres/design';
import { removalConsequences } from './removal-consequences';

const slot = (result: ParticipantTimeSlotDto['result']): ParticipantTimeSlotDto => ({
  timeSlotId: 's',
  rank: 1,
  state: 'published',
  result,
  ledGameId: null,
  withoutGame: false,
});

const aSheet = (sheet: Partial<ParticipantSheetDto>): ParticipantSheetDto => ({
  id: 'p1',
  nickname: 'Lune',
  gameMaster: false,
  signedUpGameIds: [],
  backupGameIds: [],
  timeSlots: [],
  linkedPhones: [],
  ...sheet,
});

describe('removalConsequences', () => {
  it('ne dit que le pseudo libéré pour un pseudo sans inscription, sans tirage ni téléphone', () => {
    expect(removalConsequences(aSheet({}))).toEqual(['Le pseudo redeviendra libre.']);
  });

  it('compte les inscriptions et les téléphones, et dit la place perdue dans un tirage', () => {
    expect(
      removalConsequences(
        aSheet({
          signedUpGameIds: ['a', 'b'],
          timeSlots: [
            slot({
              kind: 'assigned',
              tableName: 'Dragon',
              title: 'Néons',
              gameMasterNickname: 'É',
            }),
          ],
          linkedPhones: [
            { linkedAt: '2027-03-14T09:12:00Z' },
            { linkedAt: '2027-03-14T09:30:00Z' },
          ],
        }),
      ),
    ).toEqual([
      `Ses 2${NBSP}inscriptions seront supprimées.`,
      `Il sort des tirages, publiés compris${NBSP}: sa partie comptera un joueur de moins, et sa place ne sera proposée à personne.`,
      `Ses 2${NBSP}téléphones reliés reviendront à l'identification.`,
      'Le pseudo redeviendra libre.',
    ]);
  });

  it('parle au singulier, et d’un non placé sans place perdue', () => {
    expect(
      removalConsequences(
        aSheet({
          signedUpGameIds: ['a'],
          timeSlots: [slot({ kind: 'unassigned', tablesWithSeats: [] })],
          linkedPhones: [{ linkedAt: '2027-03-14T09:12:00Z' }],
        }),
      ),
    ).toEqual([
      'Son inscription sera supprimée.',
      'Il sort des tirages, publiés compris.',
      "Son téléphone relié reviendra à l'identification.",
      'Le pseudo redeviendra libre.',
    ]);
  });
});
