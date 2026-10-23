import { describe, expect, it } from 'vitest';
import { Convention } from '@chimeres/domain';
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
      version: 0,
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

  it('abandonne au second conflit', async () => {
    const repository = new FakeConventionRepository(2);

    await expect(
      changeConvention(repository, (convention) => convention.rename('Chimères 2027')),
    ).rejects.toBeInstanceOf(StaleConventionError);
    expect(repository.loads).toBe(2);
    expect(repository.saved).toBeUndefined();
  });
});
