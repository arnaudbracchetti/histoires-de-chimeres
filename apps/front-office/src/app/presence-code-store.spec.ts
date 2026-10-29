import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { PresenceCodeStore } from './presence-code-store';

describe('PresenceCodeStore', () => {
  /** Le magasin, créé à l'ouverture de l'application sur l'adresse `url`. */
  function openedOn(url: string): { store: PresenceCodeStore; location: Location } {
    TestBed.configureTestingModule({ providers: [provideLocationMocks()] });
    const location = TestBed.inject(Location);
    location.go(url);
    return { store: TestBed.inject(PresenceCodeStore), location };
  }

  beforeEach(() => localStorage.clear());

  it('n’a pas de code à la première ouverture sans le QR code', () => {
    expect(openedOn('/').store.code()).toBeNull();
  });

  it('garde le code de l’adresse du QR code (ID-2)', () => {
    const { store } = openedOn('/?code=K7M2');

    expect(store.code()).toBe('K7M2');
    TestBed.resetTestingModule();
    expect(openedOn('/').store.code()).toBe('K7M2');
  });

  it('efface le code de l’adresse, et garde le reste', () => {
    const { location } = openedOn('/programme?code=K7M2&creneau=2');

    expect(location.path()).toBe('/programme?creneau=2');
  });

  it('garde un code tapé', () => {
    const { store } = openedOn('/');

    store.keep('k7m2');

    expect(store.code()).toBe('k7m2');
    TestBed.resetTestingModule();
    expect(openedOn('/').store.code()).toBe('k7m2');
  });
});
