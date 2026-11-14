import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { Button } from './button';
import { Icon } from './icon';

const LABEL = 'Afficher le mot de passe';

/**
 * Un champ de mot de passe qu'on peut afficher en clair (docs/design/patterns.md, Champs) : l'œil,
 * dans le champ, à droite, bascule l'`input` projeté entre `password` et `text`. Une phrase de
 * passe se vérifie d'un coup d'œil : elle ne se saisit qu'une fois. L'envoi du formulaire la
 * remasque, pour que le gestionnaire de mots de passe du navigateur la reconnaisse.
 *
 * Sans encapsulation : le style vise l'`input` projeté, sous le sélecteur du composant.
 */
@Component({
  selector: 'app-password-reveal',
  imports: [Button, Icon],
  encapsulation: ViewEncapsulation.None,
  template: `
    <ng-content />
    <button
      type="button"
      appButton="icon"
      class="password-reveal-toggle"
      [attr.aria-label]="label"
      [title]="label"
      [attr.aria-pressed]="revealed()"
      (click)="revealed.set(!revealed())"
    >
      <app-icon [name]="revealed() ? 'eye-off' : 'eye'" />
    </button>
  `,
  styles: `
    @layer components {
      app-password-reveal {
        position: relative;
        display: block;

        > input {
          width: 100%;
          /* La place de l'œil : le texte ne passe jamais dessous. */
          padding-right: calc(var(--space-xs) * 2 + 1rem + var(--space-s));
        }

        > .password-reveal-toggle {
          position: absolute;
          top: 50%;
          right: var(--space-xxs);
          translate: 0 -50%;
        }
      }
    }
  `,
})
export class PasswordReveal {
  protected readonly label = LABEL;
  protected readonly revealed = signal(false);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    effect(() => {
      const input = host.querySelector('input');
      if (input) input.type = this.revealed() ? 'text' : 'password';
    });
    const hide = () => this.revealed.set(false);
    let form: HTMLFormElement | null = null;
    afterNextRender(() => {
      form = host.closest('form');
      form?.addEventListener('submit', hide, { capture: true });
    });
    inject(DestroyRef).onDestroy(() => form?.removeEventListener('submit', hide, true));
  }
}
