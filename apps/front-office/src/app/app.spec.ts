import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl, frontOfficeEndpoints } from '@chimeres/contract';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideLocationMocks()],
    }).compileComponents();
  });

  /** L'application ouverte, une fois lue la réponse de l'API au front office. */
  async function open(respond: (request: ReturnType<HttpTestingController['expectOne']>) => void) {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    respond(TestBed.inject(HttpTestingController).expectOne(apiUrl(frontOfficeEndpoints.read)));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const opened = (request: ReturnType<HttpTestingController['expectOne']>) =>
    request.flush({ conventionName: 'Histoires de Chimères' });
  const ended = (request: ReturnType<HttpTestingController['expectOne']>) =>
    request.flush(
      { code: 'convention-ended', title: 'La convention est terminée' },
      { status: 410, statusText: 'Gone' },
    );
  const heading = (page: HTMLElement) => page.querySelector('h1')?.textContent?.trim();

  it('souhaite la bienvenue à la convention, avec le code de présence', async () => {
    localStorage.setItem('presenceCode', 'K7M2');

    const page = await open(opened);

    expect(heading(page)).toBe('Bienvenue à Histoires de Chimères');
  });

  it('demande le code de présence quand il manque (ID-2)', async () => {
    const page = await open(opened);

    expect(heading(page)).toBe('Code de présence');
  });

  it.each([
    ['avec', 'K7M2'],
    ['sans', null],
  ])('dit que la convention est terminée, %s code', async (_, code) => {
    if (code) localStorage.setItem('presenceCode', code);

    const page = await open(ended);

    expect(heading(page)).toBe('La convention est terminée');
  });

  it('dit quand le front office ne se charge pas', async () => {
    const page = await open((request) => request.error(new ProgressEvent('error')));

    expect(page.textContent).toContain('Impossible de charger la convention.');
  });
});
