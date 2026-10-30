import { provideLocationMocks } from '@angular/common/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SwUpdate, type UnrecoverableStateEvent, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdate, PageReload } from './app-update';
import { PageVisibility } from './participant-data/page-visibility';

describe('AppUpdate', () => {
  const visible = signal(true);
  const versionUpdates = new Subject<VersionEvent>();
  const unrecoverable = new Subject<UnrecoverableStateEvent>();
  const checkForUpdate = vi.fn(async () => false);
  const reload = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    visible.set(true);
    checkForUpdate.mockClear();
    reload.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideLocationMocks(),
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: SwUpdate,
          useValue: { isEnabled: true, versionUpdates, unrecoverable, checkForUpdate },
        },
        { provide: PageVisibility, useValue: { visible } },
        { provide: PageReload, useValue: { reload } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  /** Le module, lancé avec l'application. */
  async function launched(): Promise<void> {
    TestBed.inject(AppUpdate);
    await vi.advanceTimersByTimeAsync(0);
    await TestBed.inject(ApplicationRef).whenStable();
  }

  const versionReady = () =>
    versionUpdates.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'a' },
      latestVersion: { hash: 'b' },
    });

  it('cherche une version au lancement', async () => {
    await launched();

    expect(checkForUpdate).toHaveBeenCalledOnce();
  });

  it('cherche une version toutes les 5 minutes', async () => {
    await launched();

    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('cherche une version au retour au premier plan', async () => {
    await launched();

    visible.set(false);
    TestBed.tick();
    visible.set(true);
    TestBed.tick();

    expect(checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('installe une version prête à la navigation suivante, sans rien demander', async () => {
    await launched();
    versionReady();
    expect(reload).not.toHaveBeenCalled();

    await TestBed.inject(Router).navigateByUrl('/programme');

    expect(reload).toHaveBeenCalledOnce();
  });

  it('installe une version prête au retour au premier plan suivant', async () => {
    await launched();
    versionReady();

    visible.set(false);
    TestBed.tick();
    expect(reload).not.toHaveBeenCalled();
    visible.set(true);
    TestBed.tick();

    expect(reload).toHaveBeenCalledOnce();
  });

  it('recharge aussitôt une application que le service worker ne peut plus servir', async () => {
    await launched();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'cache effacé' });

    expect(reload).toHaveBeenCalledOnce();
  });
});
