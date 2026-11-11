import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { EMPTY } from 'rxjs';
import { apiUrl, frontOfficeEndpoints, linkedPhoneEndpoints } from '@chimeres/contract';
import { App } from './app';
import { BrowserPush } from './notifications/browser-push';
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
  const linked: Respond = (request) => request.flush({ nickname: 'Élodie', gameMaster: false });
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
    expect(heading(page)).toBe('Accueil');
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

  describe('sur un iPhone sous iOS 18.6 (détection simulée)', () => {
    /** Dans Safari, `Notification` manque ; dans l'application de l'écran d'accueil, il y est. */
    function onIPhone(inApp: boolean): void {
      TestBed.overrideProvider(BrowserPush, {
        useValue: {
          messages: EMPTY,
          supported: () => inApp,
          permission: () => 'default',
          installedApp: () => inApp,
          iOSVersion: () => [18, 6],
          onPermissionChange: () => undefined,
        },
      });
    }

    it('montre d’abord « Installe l’application » dans Safari, avec le code à retenir (stories 31 et 32)', async () => {
      onIPhone(false);
      localStorage.setItem('presenceCode', 'K7M2');

      const page = await open(opened, notLinked);

      expect(heading(page)).toBe("Installe l'application");
      expect(page.querySelector('.reminder')?.textContent).toContain('K7M2');
      expect(page.querySelector('input')).toBeNull();
    });

    it('demande le pseudo dans Safari après « Continuer sans », que la confirmation propose d’abord d’éviter (story 34)', async () => {
      onIPhone(false);
      localStorage.setItem('presenceCode', 'K7M2');
      const fixture = TestBed.createComponent(App);
      await TestBed.inject(Router).navigateByUrl('/');
      fixture.detectChanges();
      const http = TestBed.inject(HttpTestingController);
      opened(http.expectOne(apiUrl(frontOfficeEndpoints.read)));
      notLinked(http.expectOne(apiUrl(linkedPhoneEndpoints.read)));
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;
      const button = (root: ParentNode, name: string) =>
        [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!;
      const confirmation = () => document.querySelector<HTMLElement>('[role="alertdialog"]')!;

      button(page, 'Continuer dans Safari, sans notifications').click();
      await fixture.whenStable();
      expect(confirmation().textContent).toContain('Sans elles, tu ne sauras ni ta table');
      button(confirmation(), "Installer l'application").click();
      await fixture.whenStable();
      expect(heading(page)).toBe("Installe l'application");

      button(page, 'Continuer dans Safari, sans notifications').click();
      await fixture.whenStable();
      button(confirmation(), 'Continuer sans').click();
      await fixture.whenStable();
      expect(heading(page)).toBe('Ton pseudo');
    });

    it('montre « Installe l’application » dans Safari avant de demander le code qui manque : il ne se tape qu’une fois', async () => {
      onIPhone(false);

      const page = await open(opened, notLinked);

      expect(heading(page)).toBe("Installe l'application");
      expect(page.querySelector('.reminder')?.textContent).toContain(
        "Il est écrit sous le QR code, sur l'affiche de l'accueil.",
      );
    });

    it('demande le code, puis le pseudo, dans l’application installée (story 33)', async () => {
      onIPhone(true);

      expect(heading(await open(opened, notLinked))).toBe('Code de présence');
    });

    it('demande le pseudo dans l’application installée qui a le code (story 33)', async () => {
      onIPhone(true);
      localStorage.setItem('presenceCode', 'K7M2');

      expect(heading(await open(opened, notLinked))).toBe('Ton pseudo');
    });

    it('entre dans la coquille, dans Safari, quand le téléphone est déjà relié', async () => {
      onIPhone(false);

      const page = await open(opened, linked);

      expect(heading(page)).toBe('Accueil');
    });
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
