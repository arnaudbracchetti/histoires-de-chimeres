import { describe, expect, it } from 'vitest';
import { Convention } from '../convention/convention.js';
import { PresenceCode } from '../convention/presence-code.js';
import type { LocalMoment } from '../convention/local-moment.js';
import { TimeOfDay } from '../convention/time-of-day.js';
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

describe("Lien d'accès du compte (ID-6, ADR 0018)", () => {
  const at = (date: string, time = '10:00'): LocalMoment => ({ date, time: TimeOfDay.parse(time) });

  function anAccountWithPassword(): Account {
    const account = Account.createForParticipant('a1', 'p-a1');
    account.replacePasswordHash('hachage');
    return account;
  }

  it('vaut 7 jours, jusqu’à la même heure', () => {
    const account = Account.createForParticipant('a1', 'p-a1');
    account.createAccessLink('jeton-1', at('2027-03-14', '08:30'));
    expect(account.accessLinkExpiresAt).toEqual(at('2027-03-21', '08:30'));
  });

  it('remet le compte à zéro : le mot de passe est effacé', () => {
    const account = anAccountWithPassword();
    account.createAccessLink('jeton-1', at('2027-03-14'));
    expect(account.passwordHash).toBeNull();
  });

  it('fait choisir le mot de passe, une seule fois', () => {
    const account = Account.createForParticipant('a1', 'p-a1');
    account.createAccessLink('jeton-1', at('2027-03-14'));
    account.useAccessLink('nouveau-hachage', at('2027-03-20'));
    expect(account.passwordHash).toBe('nouveau-hachage');
    const refusal = catchRefusal(() => account.useAccessLink('autre', at('2027-03-20')));
    expect(refusal.code).toBe('access-link-used');
    expect(account.passwordHash).toBe('nouveau-hachage');
  });

  it('refuse un lien expiré, dès son heure de fin', () => {
    const account = Account.createForParticipant('a1', 'p-a1');
    account.createAccessLink('jeton-1', at('2027-03-14', '10:00'));
    const refusal = catchRefusal(() => account.useAccessLink('h', at('2027-03-21', '10:00')));
    expect(refusal.code).toBe('access-link-expired');
    expect(account.passwordHash).toBeNull();
  });

  it('un nouveau lien remplace le précédent, même utilisé', () => {
    const account = Account.createForParticipant('a1', 'p-a1');
    account.createAccessLink('jeton-1', at('2027-03-14'));
    account.useAccessLink('h', at('2027-03-14'));
    account.createAccessLink('jeton-2', at('2027-03-15'));
    expect(account.accessLinkTokenHash).toBe('jeton-2');
    account.useAccessLink('h2', at('2027-03-15'));
    expect(account.passwordHash).toBe('h2');
  });

  it("donne l'état du compte : actif, en attente, lien expiré, lien à créer", () => {
    const account = Account.createForParticipant('a1', 'p-a1');
    expect(account.computeAccessState(at('2027-03-14'))).toBe('no-link');
    account.createAccessLink('jeton-1', at('2027-03-14'));
    expect(account.computeAccessState(at('2027-03-20'))).toBe('pending');
    expect(account.computeAccessState(at('2027-03-21'))).toBe('expired');
    account.useAccessLink('h', at('2027-03-15'));
    expect(account.computeAccessState(at('2027-03-30'))).toBe('active');
    expect(anAccountWithPassword().computeAccessState(at('2027-03-14'))).toBe('active');
  });

  it("donne le temps restant d'un lien en attente, en minutes, et rien hors attente", () => {
    const account = Account.createForParticipant('a1', 'p-a1');
    expect(account.computeAccessLinkRemainingMinutes(at('2027-03-14'))).toBeNull();
    account.createAccessLink('jeton-1', at('2027-03-14', '09:30'));

    expect(account.computeAccessLinkRemainingMinutes(at('2027-03-14', '09:30'))).toBe(7 * 24 * 60);
    expect(account.computeAccessLinkRemainingMinutes(at('2027-03-20', '23:00'))).toBe(10 * 60 + 30);
    expect(account.computeAccessLinkRemainingMinutes(at('2027-03-21', '09:29'))).toBe(1);
    expect(account.computeAccessLinkRemainingMinutes(at('2027-03-21', '09:30'))).toBeNull();
    account.useAccessLink('h', at('2027-03-15'));
    expect(account.computeAccessLinkRemainingMinutes(at('2027-03-15'))).toBeNull();
  });
});
