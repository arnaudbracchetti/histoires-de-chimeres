import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { accountEndpoints, apiUrl } from '@chimeres/contract';
import { LoginPage } from './login-page';

describe('Page de connexion', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    // Le store lit le compte dès sa création : sans session, 401.
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(accountEndpoints.read))
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const type = (label: string, value: string) => {
      const input = host.querySelector<HTMLInputElement>(
        label === 'Pseudo' ? 'input[type=text]' : 'input[type=password]',
      )!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const send = () => host.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    return { fixture, host, type, send };
  }

  it('connecte par pseudo et mot de passe, puis mène au calendrier', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { fixture, type, send } = await render();
    type('Pseudo', 'Kaïros');
    type('Mot de passe', 'une longue phrase');

    send();
    const request = TestBed.inject(HttpTestingController).expectOne(apiUrl(accountEndpoints.logIn));
    expect(request.request.body).toEqual({ nickname: 'Kaïros', password: 'une longue phrase' });
    request.flush({ nickname: 'Kaïros', organizer: true, gameMasterId: null });
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith('/');
  });

  /** Tente la connexion avec un mauvais mot de passe, refusée par l'API. */
  async function failLogIn() {
    const rendered = await render();
    rendered.type('Pseudo', 'Kaïros');
    rendered.type('Mot de passe', 'pas le bon mot');
    rendered.send();
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(accountEndpoints.logIn))
      .flush(
        {
          title: 'Pseudo ou mot de passe incorrect',
          detail: 'Vérifie.',
          code: 'wrong-credentials',
        },
        { status: 401, statusText: 'Unauthorized' },
      );
    await rendered.fixture.whenStable();
    rendered.fixture.detectChanges();
    return rendered;
  }

  const dialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');

  it('ouvre le refus dans le dialogue d’erreur, et efface la boîte de connexion', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const { host } = await failLogIn();

    expect(host.querySelector('form')).toBeNull();
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Pseudo ou mot de passe incorrect');
    expect(dialog()?.textContent).toContain('Vérifie.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('le dialogue fermé, rend la boîte de connexion, pseudo gardé, mot de passe vidé', async () => {
    const { fixture, host } = await failLogIn();

    dialog()!.querySelector<HTMLButtonElement>('button.close')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(dialog()).toBeNull();
    expect(host.querySelector<HTMLInputElement>('input[type=text]')?.value).toBe('Kaïros');
    const password = host.querySelector<HTMLInputElement>('input[type=password]')!;
    expect(password.value).toBe('');
    expect(document.activeElement).toBe(password);
    expect(host.textContent).not.toContain('Indique ton mot de passe.');
  });

  it('ne part pas sans pseudo ni mot de passe', async () => {
    const { fixture, host, send } = await render();

    send();
    await fixture.whenStable();
    fixture.detectChanges();

    TestBed.inject(HttpTestingController).expectNone(apiUrl(accountEndpoints.logIn));
    expect(host.textContent).toContain('Indique ton pseudo.');
    expect(host.textContent).toContain('Indique ton mot de passe.');
  });
});
