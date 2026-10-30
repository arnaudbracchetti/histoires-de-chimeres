import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { apiUrl, frontOfficeEndpoints, linkedPhoneEndpoints } from '@chimeres/contract';
import { App } from './app';
import { routes } from './app.routes';

type Respond = (request: TestRequest) => void;

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLocationMocks(),
        provideRouter(routes),
      ],
    }).compileComponents();
  });

  /** L'application ouverte, une fois lues les réponses de l'API : le front office, puis le pseudo relié. */
  async function open(frontOffice: Respond, linkedPhone: Respond) {
    const fixture = TestBed.createComponent(App);
    // TestBed ne lance pas la navigation initiale du démarrage.
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    frontOffice(http.expectOne(apiUrl(frontOfficeEndpoints.read)));
    linkedPhone(http.expectOne(apiUrl(linkedPhoneEndpoints.read)));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const opened: Respond = (request) => request.flush({ conventionName: 'Histoires de Chimères' });
  const ended: Respond = (request) =>
    request.flush(
      { code: 'convention-ended', title: 'La convention est terminée' },
      { status: 410, statusText: 'Gone' },
    );
  const linked: Respond = (request) => request.flush({ nickname: 'Élodie' });
  const notLinked: Respond = (request) =>
    request.flush(
      { code: 'phone-not-linked', title: 'Téléphone relié à aucun pseudo' },
      { status: 401, statusText: 'Unauthorized' },
    );
  const offline: Respond = (request) => request.error(new ProgressEvent('error'));
  /** Sans réseau ni copie, le service worker répond lui-même 504, sans corps. */
  const offlineBehindServiceWorker: Respond = (request) =>
    request.flush(null, { status: 504, statusText: 'Gateway Timeout' });
  const broken: Respond = (request) =>
    request.flush(null, { status: 500, statusText: 'Internal Server Error' });
  const heading = (page: HTMLElement) => page.querySelector('h1')?.textContent?.trim();

  it('entre dans la coquille quand le téléphone est relié, même sans code de présence', async () => {
    const page = await open(opened, linked);

    expect(page.querySelector('header button')?.textContent?.trim()).toBe('Élodie');
    const tabs = [...page.querySelectorAll('nav a')].map((tab) => tab.textContent?.trim());
    expect(tabs).toEqual(['Accueil', 'Programme', 'Mes parties']);
    expect(page.querySelector('nav a[aria-current="page"]')?.textContent?.trim()).toBe('Accueil');
    expect(page.textContent).toContain('Choisis tes parties');
  });

  it('demande le code de présence quand il manque (ID-2)', async () => {
    const page = await open(opened, notLinked);

    expect(heading(page)).toBe('Code de présence');
  });

  it('demande le pseudo, avec le code de présence, à un téléphone relié à aucun pseudo (ID-1)', async () => {
    localStorage.setItem('presenceCode', 'K7M2');

    const page = await open(opened, notLinked);

    expect(heading(page)).toBe('Ton pseudo');
  });

  it.each([
    ['avec', 'K7M2'],
    ['sans', null],
  ])('dit que la convention est terminée, %s code', async (_, code) => {
    if (code) localStorage.setItem('presenceCode', code);

    const page = await open(ended, ended);

    expect(heading(page)).toBe('La convention est terminée');
  });

  it.each([
    ['du front office', broken, notLinked],
    ['du pseudo relié', opened, broken],
  ])('dit quand la lecture %s échoue', async (_, frontOffice, linkedPhone) => {
    const page = await open(frontOffice, linkedPhone);

    expect(page.textContent).toContain('Impossible de charger la convention.');
  });

  it.each([
    ['du front office', offline, notLinked],
    ['du pseudo relié', opened, offline],
    ['derrière le service worker', offlineBehindServiceWorker, offlineBehindServiceWorker],
  ])(
    'dit qu’il faut du réseau à la première ouverture, faute de réseau %s',
    async (_, frontOffice, linkedPhone) => {
      const page = await open(frontOffice, linkedPhone);

      expect(heading(page)).toBe('Il faut du réseau');
    },
  );

  it.each([
    ['l’écran du code', opened, notLinked],
    ['la coquille', opened, linked],
    ['l’écran de fin', ended, ended],
  ])(
    'pose le motif gravé en filigrane derrière %s, masqué aux lecteurs d’écran',
    async (_, frontOffice, linkedPhone) => {
      const page = await open(frontOffice, linkedPhone);

      const watermark = page.querySelector('svg.watermark');
      expect(watermark?.getAttribute('aria-hidden')).toBe('true');
      expect(watermark?.querySelector('use')?.getAttribute('href')).toBe(
        'illustration.svg#engraving',
      );
    },
  );
});
