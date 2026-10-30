import { describe, expect, it } from 'vitest';
import { Convention, PresenceCode } from '@chimeres/domain';
import { changeConvention } from './change-convention.js';
import { StaleConventionError, type ConventionRepository } from './convention-repository.js';

/** Repository en mémoire, qui refuse les `conflicts` premières sauvegardes comme périmées. */
class FakeConventionRepository implements ConventionRepository {
  saved: Convention | undefined;
  loads = 0;

  constructor(private conflicts: number) {}

  async get(): Promise<Convention> {
    this.loads++;
    return Convention.restore({
      id: 'c1',
      name: 'Histoires de Chimères',
      date: null,
      timeSlots: [],
      tables: [],
      gameMasters: [],
      participants: [],
      signUps: [],
      games: [],
      version: 0,
      presenceCode: PresenceCode.of('K7M2'),
    });
  }

  async save(convention: Convention): Promise<void> {
    if (this.conflicts > 0) {
      this.conflicts--;
      throw new StaleConventionError();
    }
    this.saved = convention;
  }
}

describe('changeConvention', () => {
  it('rejoue une fois sur une version périmée, sur une convention rechargée', async () => {
    const repository = new FakeConventionRepository(1);

    await changeConvention(repository, (convention) => convention.rename('Chimères 2027'));

    expect(repository.loads).toBe(2);
    expect(repository.saved?.name).toBe('Chimères 2027');
  });

  it('rend les notifications de la tentative réussie, pas celles de la tentative ratée', async () => {
    const repository = new FakeConventionRepository(1);
    let attempts = 0;

    const notifications = await changeConvention(repository, () => [`tentative ${++attempts}`]);

    expect(notifications).toEqual(['tentative 2']);
  });

  it('abandonne au second conflit', async () => {
    const repository = new FakeConventionRepository(2);

    await expect(
      changeConvention(repository, (convention) => convention.rename('Chimères 2027')),
    ).rejects.toBeInstanceOf(StaleConventionError);
    expect(repository.loads).toBe(2);
    expect(repository.saved).toBeUndefined();
  });

  it('rend le résultat de l’action, et ne sauvegarde pas quand `changed` le refuse', async () => {
    const repository = new FakeConventionRepository(0);

    const result = await changeConvention(
      repository,
      (convention) => convention.name,
      () => false,
    );

    expect(result).toBe('Histoires de Chimères');
    expect(repository.saved).toBeUndefined();
  });
});
