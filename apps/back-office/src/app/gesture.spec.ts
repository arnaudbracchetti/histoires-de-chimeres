import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import type { ProblemDto } from '@chimeres/contract';
import { injectGesture } from './gesture';
import { Notifications } from './shell/notifications';

/** Une écriture refusée par l'API, avec ce Problem Details. */
function refusedWith(status: number, problem?: Partial<ProblemDto>) {
  return () => Promise.reject(new HttpErrorResponse({ status, error: problem ?? null }));
}

/** Une écriture qui attend `resolve()`. */
function pending<T>(value: T) {
  let resolve!: () => void;
  const promise = new Promise<T>((done) => (resolve = () => done(value)));
  return { action: () => promise, resolve };
}

describe('Gesture', () => {
  const create = (options?: { notify?: boolean }) =>
    TestBed.runInInjectionContext(() => injectGesture(options));

  it('renvoie la valeur de l’écriture réussie, sans refus', async () => {
    const gesture = create();

    expect(await gesture.run(() => Promise.resolve('fait'))).toEqual({
      status: 'done',
      value: 'fait',
    });
    expect(gesture.refusal()).toBeUndefined();
  });

  it('en place, un refus s’écrit par son detail, à défaut par son title', async () => {
    const gesture = create();

    await gesture.run(refusedWith(422, { title: 'Table prise', detail: 'La table est prise.' }));
    expect(gesture.refusal()?.message).toBe('La table est prise.');

    await gesture.run(refusedWith(422, { title: 'Table prise' }));
    expect(gesture.refusal()?.message).toBe('Table prise');
  });

  it('des erreurs de champ seules s’écrivent bout à bout', async () => {
    const gesture = create();

    await gesture.run(
      refusedWith(422, {
        title: 'Requête refusée',
        errors: [
          { field: 'start', code: 'time-slot-end-not-after-start', message: 'Début illisible.' },
          { field: 'end', code: 'time-slot-end-not-after-start', message: 'Fin illisible.' },
        ],
      }),
    );

    expect(gesture.refusal()?.message).toBe('Début illisible. Fin illisible.');
  });

  it('une coupure et une erreur 500 ont leur message sobre', async () => {
    const gesture = create();

    await gesture.run(refusedWith(0));
    expect(gesture.refusal()?.message).toBe("Pas de connexion\u00a0: rien n'a été enregistré.");

    await gesture.run(refusedWith(500, { title: 'Erreur interne' }));
    expect(gesture.refusal()?.message).toBe('Une erreur est survenue, réessaie.');
  });

  it.each([404, 409, 422])('un refus %i dit que l’écran est périmé', async (status) => {
    const outcome = await create().run(refusedWith(status, { title: 'Refus' }));

    expect(outcome).toMatchObject({ status: 'refused', refusal: { stale: true } });
  });

  it.each([0, 400, 413, 415, 500])('un refus %i laisse l’écran tel quel', async (status) => {
    const outcome = await create().run(refusedWith(status, { title: 'Refus' }));

    expect(outcome).toMatchObject({ status: 'refused', refusal: { stale: false } });
  });

  it('une erreur du front lui-même n’est pas un écran périmé', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const outcome = await create().run(() => Promise.reject(new Error('bogue')));

    expect(outcome).toMatchObject({
      status: 'refused',
      refusal: { message: 'Une erreur est survenue, réessaie.', stale: false },
    });
  });

  it('pendant un envoi, un second est sans effet ; le suivant efface le refus', async () => {
    const gesture = create();
    await gesture.run(refusedWith(422, { title: 'Refus' }));
    const first = pending('premier');
    const second = vi.fn(() => Promise.resolve('second'));

    const running = gesture.run(first.action);
    expect(gesture.running()).toBe(true);
    expect(gesture.refusal()).toBeUndefined();
    expect(await gesture.run(second)).toEqual({ status: 'busy' });
    expect(second).not.toHaveBeenCalled();

    first.resolve();
    expect(await running).toEqual({ status: 'done', value: 'premier' });
    expect(gesture.running()).toBe(false);
  });

  it('des clés différentes partent en même temps, une même clé attend', async () => {
    const gesture = create();
    const s1 = pending('s1');

    const running = gesture.run(s1.action, 's1');
    expect(gesture.isRunning('s1')).toBe(true);
    expect(gesture.isRunning('s2')).toBe(false);
    expect(await gesture.run(() => Promise.resolve('s2'), 's2')).toEqual({
      status: 'done',
      value: 's2',
    });
    expect(await gesture.run(() => Promise.resolve('encore'), 's1')).toEqual({ status: 'busy' });

    s1.resolve();
    await running;
    expect(gesture.isRunning('s1')).toBe(false);
  });

  it('avec notify, le refus part aussi en notification, title et detail', async () => {
    const gesture = create({ notify: true });

    await gesture.run(
      refusedWith(404, { title: 'Partie introuvable', detail: 'Elle n’existe plus.' }),
    );

    expect(TestBed.inject(Notifications).notices()).toEqual([
      expect.objectContaining({ title: 'Partie introuvable', detail: 'Elle n’existe plus.' }),
    ]);
  });

  it('sans notify, aucune notification', async () => {
    await create().run(refusedWith(404, { title: 'Partie introuvable' }));

    expect(TestBed.inject(Notifications).notices()).toEqual([]);
  });
});
