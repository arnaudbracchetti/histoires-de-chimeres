import { TestBed } from '@angular/core/testing';
import { AlertStack } from './alert-stack';
import { Alerts } from './alerts';

describe('Alerts', () => {
  function render() {
    const fixture = TestBed.createComponent(AlertStack);
    fixture.detectChanges();
    const service = TestBed.inject(Alerts);
    const host = fixture.nativeElement as HTMLElement;
    const show = (title: string, detail?: string) => {
      service.error({ title, detail });
      fixture.detectChanges();
    };
    const alerts = () => [...host.querySelectorAll('[role="alert"]')];
    return { fixture, show, alerts };
  }

  it('affiche une erreur avec son titre en gras et son détail dessous', () => {
    const { show, alerts } = render();

    show('Table prise', 'La table Dragon est déjà prise sur le créneau 2.');

    expect(alerts()).toHaveLength(1);
    expect(alerts()[0].querySelector('strong')?.textContent).toBe('Table prise');
    expect(alerts()[0].textContent).toContain('La table Dragon est déjà prise sur le créneau 2.');
  });

  it('garde trois erreurs au plus : la plus ancienne se ferme', () => {
    const { show, alerts } = render();

    show('Première');
    show('Deuxième');
    show('Troisième');
    show('Quatrième');

    expect(alerts().map((alert) => alert.querySelector('strong')?.textContent)).toEqual([
      'Deuxième',
      'Troisième',
      'Quatrième',
    ]);
  });

  it('ferme une erreur par son bouton ✕', () => {
    const { fixture, show, alerts } = render();
    show('Première');
    show('Deuxième');

    alerts()[0].querySelector<HTMLButtonElement>('button[aria-label="Fermer"]')!.click();
    fixture.detectChanges();

    expect(alerts().map((alert) => alert.querySelector('strong')?.textContent)).toEqual([
      'Deuxième',
    ]);
  });
});
