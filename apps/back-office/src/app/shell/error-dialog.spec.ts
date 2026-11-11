import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorDialog } from './error-dialog';

@Component({
  template: `<button type="button" class="opener" (click)="open()">Agir</button>`,
})
class Host {
  readonly errorDialog = inject(ErrorDialog);
  closed: string[] = [];

  open() {
    for (const title of ['Table prise', 'Créneau introuvable']) {
      void this.errorDialog
        .open({ title, detail: `Détail de ${title}.` })
        .then(() => this.closed.push(title));
    }
  }
}

describe('Dialogue d’erreur', () => {
  async function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const opener = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.opener',
    )!;
    opener.focus();
    opener.click();
    await fixture.whenStable();
    const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
    const close = async () => {
      dialog()!.querySelector<HTMLButtonElement>('button.close')!.click();
      await fixture.whenStable();
    };
    return { fixture, opener, dialog, close };
  }

  it('montre le motif en titre, la phrase dessous, et « Fermer », qui a le focus', async () => {
    const { dialog } = await render();

    expect(dialog()?.querySelector('h2')?.textContent).toBe('Table prise');
    expect(dialog()?.querySelector('.refusal')?.textContent).toBe('Détail de Table prise.');
    expect(document.activeElement?.textContent?.trim()).toBe('Fermer');
  });

  it('montre les erreurs l’une après l’autre, puis rend le focus à l’élément d’avant', async () => {
    const { fixture, opener, dialog, close } = await render();

    await close();
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Créneau introuvable');
    expect(fixture.componentInstance.closed).toEqual(['Table prise']);

    await close();
    expect(dialog()).toBeNull();
    expect(fixture.componentInstance.closed).toEqual(['Table prise', 'Créneau introuvable']);
    expect(fixture.componentInstance.errorDialog.pending()).toEqual([]);
    expect(document.activeElement).toBe(opener);
  });
});
