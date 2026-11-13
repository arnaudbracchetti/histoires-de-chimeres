import { describe, expect, it } from 'vitest';
import { isAccessAllowed } from './access.js';

const gameMaster = { organizer: false, gameMasterId: 'mj-lune' };
const organizer = { organizer: true, gameMasterId: null };
/** Un compte sans rôle MJ ni Organisateur : il ne devrait pas exister, et n'ouvre rien. */
const noRole = { organizer: false, gameMasterId: null };

describe('isAccessAllowed', () => {
  it('ouvre `public` et `linkedPhone` à tous, même sans compte', () => {
    expect(isAccessAllowed('public', null)).toBe(true);
    expect(isAccessAllowed('linkedPhone', null)).toBe(true);
  });

  it('ouvre `gameMaster` à un MJ ou à un Organisateur, pas à un compte sans rôle', () => {
    expect(isAccessAllowed('gameMaster', gameMaster)).toBe(true);
    expect(isAccessAllowed('gameMaster', organizer)).toBe(true);
    expect(isAccessAllowed('gameMaster', noRole)).toBe(false);
    expect(isAccessAllowed('gameMaster', null)).toBe(false);
  });

  it('ouvre `ownGameMaster` au MJ du chemin seul, et à tout Organisateur (PR-13)', () => {
    expect(isAccessAllowed('ownGameMaster', gameMaster, 'mj-lune')).toBe(true);
    expect(isAccessAllowed('ownGameMaster', gameMaster, 'mj-soleil')).toBe(false);
    expect(isAccessAllowed('ownGameMaster', gameMaster)).toBe(false);
    expect(isAccessAllowed('ownGameMaster', organizer, 'mj-soleil')).toBe(true);
  });

  it('réserve `organizer` aux Organisateurs', () => {
    expect(isAccessAllowed('organizer', organizer)).toBe(true);
    expect(isAccessAllowed('organizer', gameMaster)).toBe(false);
  });
});
