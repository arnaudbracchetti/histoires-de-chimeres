import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Loadable, type LoadableResource } from './loadable';

/** Lecture simulée, pilotée par le test. */
class FakeRead implements LoadableResource {
  readonly isLoading = signal(true);
  readonly error = signal<Error | undefined>(undefined);
  reloads = 0;

  reload(): boolean {
    this.reloads++;
    return true;
  }
}

@Component({
  imports: [Loadable],
  template: `<app-loadable
    [resource]="read"
    failure="Impossible de charger les scénarios."
    [notFound]="notFound()"
    ><p>Contenu</p></app-loadable
  >`,
})
class Host {
  readonly read = new FakeRead();
  readonly notFound = signal<string | undefined>(undefined);
}

describe('Loadable', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function render(notFound?: string) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.notFound.set(notFound);
    fixture.detectChanges();
    const zone = (fixture.nativeElement as HTMLElement).querySelector('app-loadable')!;
    const wait = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };
    return { fixture, read: fixture.componentInstance.read, zone, wait };
  }

  it("n'affiche rien pendant 300 ms, puis une barre de progression", () => {
    const { zone, wait } = render();

    wait(299);
    expect(zone.querySelector('[role="progressbar"]')).toBeNull();
    expect(zone.getAttribute('aria-busy')).toBe('true');

    wait(1);
    expect(zone.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('ne montre pas de barre pour une lecture plus courte que 300 ms', () => {
    const { fixture, read, zone, wait } = render();

    wait(200);
    read.isLoading.set(false);
    fixture.detectChanges();
    wait(200);

    expect(zone.querySelector('[role="progressbar"]')).toBeNull();
    expect(zone.getAttribute('aria-busy')).toBe('false');
    expect(zone.textContent).toContain('Contenu');
  });

  it("affiche l'échec d'une lecture et la relance par « Réessayer »", () => {
    const { fixture, read, zone } = render();

    read.isLoading.set(false);
    read.error.set(new Error('500'));
    fixture.detectChanges();

    expect(zone.textContent).toContain('Impossible de charger les scénarios.');
    expect(zone.textContent).not.toContain('Contenu');
    const retry = [...zone.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Réessayer'),
    );
    retry!.click();
    expect(read.reloads).toBe(1);
  });

  it("affiche « n'existe pas, ou plus » sur un 404, sans « Réessayer »", () => {
    const { fixture, read, zone } = render("Ce scénario n'existe pas, ou plus.");

    read.isLoading.set(false);
    read.error.set(new HttpErrorResponse({ status: 404 }));
    fixture.detectChanges();

    expect(zone.textContent).toContain("Ce scénario n'existe pas, ou plus.");
    expect(zone.textContent).not.toContain('Impossible de charger les scénarios.');
    expect(zone.querySelector('button')).toBeNull();
  });

  it("garde le message d'échec sur un 404 quand la zone ne prévoit pas de ressource absente", () => {
    const { fixture, read, zone } = render();

    read.isLoading.set(false);
    read.error.set(new HttpErrorResponse({ status: 404 }));
    fixture.detectChanges();

    expect(zone.textContent).toContain('Impossible de charger les scénarios.');
    expect(zone.textContent).toContain('Réessayer');
  });
});
