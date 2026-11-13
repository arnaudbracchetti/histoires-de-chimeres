import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { accessLinkEndpoints, accountEndpoints, apiUrl } from '@chimeres/contract';
import { AccessLinkPage } from './access-link-page';

const TOKEN = 'jeton-du-lien';

describe("Page du lien d'accès : choisir son mot de passe (ID-6, ADR 0018)", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
  });

  /** Ouvre la page ; l'API répond au GET du lien par `flush`. */
  async function render(flush: (request: ReturnType<HttpTestingController['expectOne']>) => void) {
    const fixture = TestBed.createComponent(AccessLinkPage);
    fixture.componentRef.setInput('token', TOKEN);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    // Le store lit le compte dès sa création : sans session, 401.
    http
      .match(apiUrl(accountEndpoints.read))
      .forEach((request) => request.flush(null, { status: 401, statusText: 'Unauthorized' }));
    flush(http.expectOne(apiUrl(accessLinkEndpoints.read, { token: TOKEN })));
    await fixture.whenStable();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const type = (index: number, value: string) => {
      const input = host.querySelectorAll<HTMLInputElement>('input[type=password]')[index]!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    return { fixture, host, http, type };
  }

  it('titre par le pseudo du compte, et suggère une courte phrase', async () => {
    const { host } = await render((request) => request.flush({ nickname: 'Lune' }));

    expect(host.querySelector('h1')?.textContent?.trim()).toBe('Lune, choisis ton mot de passe');
    expect(host.querySelector('h1 + p')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `Tu te connecteras ensuite avec ton pseudo, Lune, et ce mot de passe.`,
    );
    expect(host.textContent).toContain('une courte phrase');
  });

  it('montre le pseudo en champ en lecture seule, pour le gestionnaire de mots de passe', async () => {
    const { host } = await render((request) => request.flush({ nickname: 'Lune' }));

    const nickname = host.querySelector<HTMLInputElement>('form input[autocomplete="username"]')!;
    expect(nickname.readOnly).toBe(true);
    expect(nickname.value).toBe('Lune');
    expect(nickname.labels?.[0]?.textContent?.trim()).toBe('Pseudo');
  });

  it('envoie le mot de passe par le lien, puis mène au calendrier', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const { fixture, host, http, type } = await render((request) =>
      request.flush({ nickname: 'Lune' }),
    );
    type(0, 'une longue phrase');
    type(1, 'une longue phrase');

    host.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
    const request = http.expectOne(apiUrl(accessLinkEndpoints.choosePassword, { token: TOKEN }));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ password: 'une longue phrase' });
    request.flush({ nickname: 'Lune', participantId: 'p1', organizer: false, gameMasterId: 'g1' });
    await vi.waitFor(() => expect(navigate).toHaveBeenCalled());

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('dit un lien expiré, sans formulaire', async () => {
    const { host } = await render((request) =>
      request.flush(
        {
          code: 'access-link-expired',
          status: 410,
          title: "Lien d'accès expiré",
          detail: 'Ce lien a dépassé ses 7 jours.',
        },
        { status: 410, statusText: 'Gone' },
      ),
    );

    expect(host.textContent).toContain("Lien d'accès expiré");
    expect(host.textContent).toContain('Ce lien a dépassé ses 7 jours.');
    expect(host.querySelector('input')).toBeNull();
  });
});
