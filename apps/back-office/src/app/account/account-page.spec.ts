import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { accountEndpoints, apiUrl } from '@chimeres/contract';
import { AccountPage } from './account-page';

describe('Page « Mon compte » : changer son mot de passe (ADR 0019)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(accountEndpoints.read))
      .flush({ nickname: 'Kaïros', organizer: true, gameMasterId: null });
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    /** Le champ dont le libellé est donné. */
    const input = (label: string) => {
      const labelElement = [...host.querySelectorAll('label')].find(
        (element) => element.textContent?.trim() === label,
      )!;
      return host.querySelector<HTMLInputElement>(`#${labelElement.htmlFor}`)!;
    };
    const type = (label: string, value: string) => {
      input(label).value = value;
      input(label).dispatchEvent(new Event('input'));
    };
    const send = async () => {
      host.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, host, input, type, send };
  }

  it('envoie le mot de passe actuel et le nouveau, puis vide les champs', async () => {
    const { fixture, host, input, type, send } = await render();
    type('Mot de passe actuel', 'une longue phrase');
    type('Nouveau mot de passe', 'une autre longue phrase');

    const sent = send();
    const request = TestBed.inject(HttpTestingController).expectOne(
      apiUrl(accountEndpoints.changePassword),
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      currentPassword: 'une longue phrase',
      password: 'une autre longue phrase',
    });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await sent;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(input('Mot de passe actuel').value).toBe('');
    expect(input('Nouveau mot de passe').value).toBe('');
    expect(host.textContent).toContain('Enregistré');
  });

  it('affiche sous son champ un mot de passe actuel refusé par l’API', async () => {
    const { fixture, host, input, type, send } = await render();
    type('Mot de passe actuel', 'pas le bon mot');
    type('Nouveau mot de passe', 'une autre longue phrase');

    const sent = send();
    const message = 'Vérifie ton mot de passe actuel.';
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(accountEndpoints.changePassword))
      .flush(
        {
          title: 'Mot de passe actuel incorrect',
          code: 'current-password-wrong',
          errors: [{ field: 'currentPassword', code: 'current-password-wrong', message }],
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await sent;
    await fixture.whenStable();
    fixture.detectChanges();

    const current = input('Mot de passe actuel');
    expect(current.getAttribute('aria-invalid')).toBe('true');
    expect(
      host.querySelector(`#${current.getAttribute('aria-describedby')}`)?.textContent,
    ).toContain(message);
  });

  it('ne part pas sans mot de passe actuel, ni avec un nouveau trop court', async () => {
    const { host, type, send } = await render();
    type('Nouveau mot de passe', 'court');

    await send();

    TestBed.inject(HttpTestingController).expectNone(apiUrl(accountEndpoints.changePassword));
    expect(host.textContent).toContain('Indique ton mot de passe actuel.');
    expect(host.textContent).toMatch(/Le mot de passe fait au moins 10\scaractères/);
  });

  it('affiche le nouveau mot de passe en clair par son œil, et le remasque à l’envoi', async () => {
    const { fixture, host, input, type, send } = await render();
    const eyes = host.querySelectorAll<HTMLButtonElement>('button[aria-pressed]');
    expect(eyes).toHaveLength(2);

    eyes[1]!.click();
    fixture.detectChanges();

    expect(eyes[1]!.getAttribute('aria-label')).toBe('Afficher le mot de passe');
    expect(eyes[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(input('Nouveau mot de passe').type).toBe('text');
    expect(input('Mot de passe actuel').type).toBe('password');

    type('Nouveau mot de passe', 'court');
    await send();

    expect(input('Nouveau mot de passe').type).toBe('password');
    expect(eyes[1]!.getAttribute('aria-pressed')).toBe('false');
  });
});
