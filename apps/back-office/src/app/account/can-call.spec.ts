import {
  gameMasterEndpoints,
  healthEndpoints,
  scenarioEndpoints,
  type ConnectedAccountDto,
} from '@chimeres/contract';
import { canCall } from './can-call';

const gameMaster: ConnectedAccountDto = {
  participantId: 'p-lune',
  nickname: 'Lune',
  organizer: false,
  gameMasterId: 'mj-lune',
};
const organizer: ConnectedAccountDto = {
  participantId: 'p-orga',
  nickname: 'Orga',
  organizer: true,
  gameMasterId: null,
};

describe('canCall', () => {
  it('ouvre un endpoint public à tous, même sans session', () => {
    expect(canCall(undefined, healthEndpoints.check)).toBe(true);
  });

  it('ouvre un endpoint de MJ à toute session, et à personne sans session', () => {
    expect(canCall(gameMaster, scenarioEndpoints.list)).toBe(true);
    expect(canCall(organizer, scenarioEndpoints.list)).toBe(true);
    expect(canCall(undefined, scenarioEndpoints.list)).toBe(false);
  });

  it('ouvre un endpoint de son propre MJ à ce MJ seul, et à tout Organisateur', () => {
    const own = { gameMasterId: 'mj-lune', scenarioId: 's1' };
    const other = { gameMasterId: 'mj-soleil', scenarioId: 's2' };

    expect(canCall(gameMaster, scenarioEndpoints.update, own)).toBe(true);
    expect(canCall(gameMaster, scenarioEndpoints.update, other)).toBe(false);
    expect(canCall(organizer, scenarioEndpoints.update, other)).toBe(true);
  });

  it('réserve aux Organisateurs un endpoint sans niveau', () => {
    expect(canCall(organizer, gameMasterEndpoints.list)).toBe(true);
    expect(canCall(gameMaster, gameMasterEndpoints.list)).toBe(false);
    expect(canCall(gameMaster, gameMasterEndpoints.remove, { gameMasterId: 'mj-lune' })).toBe(
      false,
    );
  });
});
