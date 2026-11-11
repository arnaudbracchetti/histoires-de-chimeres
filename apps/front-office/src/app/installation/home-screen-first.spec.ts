import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PushNotifications, type PushStatus } from '../notifications/push-notifications';
import { HomeScreenFirst } from './home-screen-first';

describe('HomeScreenFirst', () => {
  const status = signal<PushStatus>('default');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PushNotifications, useValue: { status } }],
    });
  });

  const homeScreenFirst = () => TestBed.inject(HomeScreenFirst);

  it('fait installer d’abord, sur un iPhone hors de l’écran d’accueil (story 31)', () => {
    status.set('not-on-home-screen');

    expect(homeScreenFirst().due()).toBe(true);
  });

  it.each<PushStatus>(['default', 'granted', 'denied'])(
    'laisse taper le pseudo dans l’application installée (permission %s, story 33)',
    (permission) => {
      status.set(permission);

      expect(homeScreenFirst().due()).toBe(false);
    },
  );

  it('laisse taper le pseudo sur un téléphone qui ne peut pas recevoir les notifications', () => {
    status.set('unsupported');

    expect(homeScreenFirst().due()).toBe(false);
  });

  it('laisse taper le pseudo après « Continuer dans Safari, sans notifications » (story 34)', () => {
    status.set('not-on-home-screen');

    homeScreenFirst().continueInBrowser();

    expect(homeScreenFirst().due()).toBe(false);
  });
});
