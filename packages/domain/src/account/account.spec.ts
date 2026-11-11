import { describe, expect, it } from 'vitest';
import { Convention } from '../convention/convention.js';
import { PresenceCode } from '../convention/presence-code.js';
import { Refusal } from '../refusal.js';
import { Account } from './account.js';

function anOrganizer(id: string): Account {
  const account = Account.createForParticipant(id, `p-${id}`);
  account.appointOrganizer();
  return account;
}

function catchRefusal(action: () => void): Refusal {
  try {
    action();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error('Aucun refus');
}

describe('Rôle Organisateur du compte (ID-16)', () => {
  it("retire le rôle d'Organisateur d'un autre Organisateur", () => {
    const other = anOrganizer('a2');

    other.withdrawOrganizerRole(anOrganizer('a1'));

    expect(other.isOrganizer).toBe(false);
  });

  it("refuse qu'un Organisateur se retire lui-même le rôle d'Organisateur", () => {
    const me = anOrganizer('a1');

    const refusal = catchRefusal(() => me.withdrawOrganizerRole(anOrganizer('a1')));

    expect(refusal.code).toBe('own-organizer-role-withdrawal');
    expect(me.isOrganizer).toBe(true);
  });
});

describe('Compte sans rôle (ID-16)', () => {
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
    convention.addParticipant('p-a1', 'Élodie');
    return convention;
  }

  it("n'a plus de rôle, ni Organisateur, ni MJ", () => {
    expect(Account.createForParticipant('a1', 'p-a1').isWithoutRole(aConvention())).toBe(true);
  });

  it('garde un rôle quand il est Organisateur', () => {
    expect(anOrganizer('a1').isWithoutRole(aConvention())).toBe(false);
  });

  it('donne son seul rôle, ou rien quand il en a deux', () => {
    const convention = aConvention();
    const account = Account.createForParticipant('a1', 'p-a1');
    account.appointOrganizer();
    expect(account.findOnlyRole(convention)).toBe('organizer');

    convention.appointGameMaster('g1', 'p-a1');
    expect(account.findOnlyRole(convention)).toBeNull();
    expect(Account.createForParticipant('a1', 'p-a1').findOnlyRole(convention)).toBe('game-master');
  });

  it('garde un rôle quand son participant est MJ', () => {
    const convention = aConvention();
    convention.appointGameMaster('g1', 'p-a1');

    expect(Account.createForParticipant('a1', 'p-a1').isWithoutRole(convention)).toBe(false);
  });
});
