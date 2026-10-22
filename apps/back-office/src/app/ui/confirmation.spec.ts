import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ProblemDto } from '@chimeres/contract';
import { Confirmation } from './confirmation';

@Component({
  template: `<button type="button" (click)="open()">Ouvrir</button>`,
})
class Host {
  private readonly confirmation = inject(Confirmation);
  action = vi.fn<() => Promise<void>>(() => Promise.resolve());
  result: Promise<boolean> | undefined;

  open() {
    this.result = this.confirmation.ask({
      question: 'Supprimer le créneau 2\u202f?',
      confirmLabel: 'Supprimer le créneau',
      action: this.action,
    });
  }
}

describe('Confirmation', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const opener = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    opener.focus();
    opener.click();
    await fixture.whenStable();
    const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
    const button = (name: string) =>
      [...(dialog()?.querySelectorAll('button') ?? [])].find((b) => b.textContent?.trim() === name);
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, opener, dialog, button, settle };
  }

  it('pose la question, avec le focus initial sur « Annuler »', async () => {
    const { dialog, button } = await render();

    expect(dialog()?.textContent).toContain('Supprimer le créneau 2\u202f?');
    expect(button('Supprimer le créneau')).toBeDefined();
    expect(document.activeElement).toBe(button('Annuler'));
  });

  it('« Annuler » ferme sans rien faire, et rend le focus à l’élément d’origine', async () => {
    const { host, opener, dialog, button, settle } = await render();

    button('Annuler')!.click();
    await settle();

    expect(dialog()).toBeNull();
    expect(host.action).not.toHaveBeenCalled();
    expect(await host.result).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('le bouton destructeur exécute l’action, puis ferme', async () => {
    const { host, dialog, button, settle } = await render();

    button('Supprimer le créneau')!.click();
    await settle();

    expect(host.action).toHaveBeenCalledOnce();
    expect(await host.result).toBe(true);
    expect(dialog()).toBeNull();
  });

  it('affiche un refus dans le dialogue, sans bouton destructeur, avec « Fermer »', async () => {
    const { host, dialog, button, settle } = await render();
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:time-slot-not-found',
      title: 'Créneau introuvable',
      status: 404,
      detail: 'Ce créneau n’existe plus.',
      code: 'time-slot-not-found',
    };
    host.action.mockRejectedValue(new HttpErrorResponse({ status: 404, error: problem }));

    button('Supprimer le créneau')!.click();
    await settle();

    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain(
      'Ce créneau n’existe plus.',
    );
    expect(button('Supprimer le créneau')).toBeUndefined();
    button('Fermer')!.click();
    await settle();
    expect(await host.result).toBe(false);
  });
});
