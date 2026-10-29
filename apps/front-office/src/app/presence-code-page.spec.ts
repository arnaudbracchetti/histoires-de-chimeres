import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl, frontOfficeEndpoints, type ProblemDto } from '@chimeres/contract';
import { PresenceCodePage } from './presence-code-page';
import { PresenceCodeStore } from './presence-code-store';

const VERIFY_URL = apiUrl(frontOfficeEndpoints.verifyPresenceCode);
const WRONG_CODE = "Ce code ne correspond pas. Vérifie-le sur l'affiche, sous le QR code.";

describe('PresenceCodePage', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PresenceCodePage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideLocationMocks()],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(PresenceCodePage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    const input = page.querySelector('input')!;
    return {
      fixture,
      page,
      input,
      /** Tape le code, puis envoie le formulaire. */
      async enter(code: string) {
        input.value = code;
        input.dispatchEvent(new Event('input'));
        page.querySelector('form')!.dispatchEvent(new Event('submit'));
        await fixture.whenStable();
      },
      error: () => page.querySelector('.error')?.textContent?.trim() ?? '',
      /** Laisse finir l'envoi, puis l'affichage. */
      async settle() {
        await new Promise((resolve) => setTimeout(resolve));
        await fixture.whenStable();
      },
    };
  }

  const http = () => TestBed.inject(HttpTestingController);
  const refuse = (problem: Partial<ProblemDto>, status: number) =>
    http().expectOne(VERIFY_URL).flush(problem, { status, statusText: 'Refusé' });

  it('dit où trouver le code : sous le QR code de l’affiche (ID-2)', () => {
    const { page } = render();

    expect(page.querySelector('h1')?.textContent).toContain('Code de présence');
    expect(page.textContent).toContain('sous le QR code');
  });

  it('garde un bon code, tel que tapé', async () => {
    const { enter, settle } = render();

    await enter('k7m2');
    const request = http().expectOne(VERIFY_URL);
    expect(request.request.body).toEqual({ presenceCode: 'k7m2' });
    request.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(TestBed.inject(PresenceCodeStore).code()).toBe('k7m2');
  });

  it('affiche le message de l’API sous le champ pour un code faux, et ne le garde pas', async () => {
    const { enter, settle, error, input } = render();

    await enter('AAAAAA');
    refuse(
      {
        code: 'presence-code-wrong',
        title: 'Code incorrect',
        errors: [{ field: 'presenceCode', code: 'presence-code-wrong', message: WRONG_CODE }],
      },
      422,
    );
    await settle();

    expect(error()).toBe(WRONG_CODE);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(TestBed.inject(PresenceCodeStore).code()).toBeNull();
  });

  it('demande le code sans rien envoyer quand le champ est vide', async () => {
    const { enter, fixture, error } = render();

    await enter('   ');
    fixture.detectChanges();

    http().expectNone(VERIFY_URL);
    expect(error()).toBe('Tape le code de présence.');
  });

  it('signale la fin de la convention', async () => {
    const { enter, settle, fixture } = render();
    let ended = false;
    fixture.componentInstance.ended.subscribe(() => (ended = true));

    await enter('K7M2');
    refuse({ code: 'convention-ended', title: 'La convention est terminée' }, 410);
    await settle();

    expect(ended).toBe(true);
  });
});
