import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { THIN_NBSP } from '../typography/french';
import { leaveUnsaved, type UnsavedChanges } from './leave-unsaved';

@Component({ template: 'Scénario' })
class Editing implements UnsavedChanges {
  static unsaved = false;
  hasUnsavedChanges(): boolean {
    return Editing.unsaved;
  }
}

@Component({ template: 'Ailleurs' })
class Elsewhere {}

describe('leaveUnsaved', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'scenario', component: Editing, canDeactivate: [leaveUnsaved] },
          { path: 'ailleurs', component: Elsewhere },
        ]),
      ],
    });
  });

  async function openScenario(unsaved: boolean) {
    Editing.unsaved = unsaved;
    const harness = await RouterTestingHarness.create('/scenario');
    const router = TestBed.inject(Router);
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      // La navigation reste en attente du dialogue : pas de whenStable(), qui l'attendrait.
      TestBed.inject(ApplicationRef).tick();
    };
    const dialog = () => document.querySelector('app-confirm-dialog');
    const button = (name: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')].find(
        (b) => b.textContent?.trim() === name,
      )!;
    return { harness, router, settle, dialog, button };
  }

  it('laisse partir sans rien demander quand rien n’a changé', async () => {
    const { router, dialog } = await openScenario(false);

    expect(await router.navigateByUrl('/ailleurs')).toBe(true);
    expect(dialog()).toBeNull();
  });

  it('demande « Quitter sans enregistrer ? », et reste sur « Annuler »', async () => {
    const { router, settle, dialog, button } = await openScenario(true);

    const navigation = router.navigateByUrl('/ailleurs');
    await settle();
    expect(dialog()?.querySelector('h2')?.textContent).toBe(`Quitter sans enregistrer${THIN_NBSP}?`);
    expect(document.activeElement).toBe(button('Annuler'));
    button('Annuler').click();

    expect(await navigation).toBe(false);
    expect(router.url).toBe('/scenario');
  });

  it('quitte la page sur « Quitter sans enregistrer »', async () => {
    const { router, settle, button } = await openScenario(true);

    const navigation = router.navigateByUrl('/ailleurs');
    await settle();
    button('Quitter sans enregistrer').click();

    expect(await navigation).toBe(true);
    expect(router.url).toBe('/ailleurs');
  });
});
