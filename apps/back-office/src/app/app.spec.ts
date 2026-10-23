import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { apiUrl, conventionEndpoints, scenarioEndpoints } from '@chimeres/contract';
import { App } from './app';
import { routes } from './app.routes';
import { Announcer } from './shell/announcer';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  async function render() {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    const navigate = async (url: string) => {
      await router.navigateByUrl(url);
      await fixture.whenStable();
    };
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(apiUrl(conventionEndpoints.read))
      .flush({ id: 'c1', name: 'Histoires de Chimères', date: null, timeSlots: [], tables: [] });
    await navigate('/');
    return { host: fixture.nativeElement as HTMLElement, navigate, router, fixture };
  }

  it('après une navigation, met le focus sur le h1 de la page', async () => {
    const { host, router, fixture } = await render();

    await router.navigateByUrl('/scenarios');
    // La page charge ses scénarios : la requête est servie pour que l'application se stabilise.
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(apiUrl(scenarioEndpoints.list)).flush([]);
    await fixture.whenStable();

    const title = host.querySelector('main h1');
    expect(title?.textContent).toBe('Scénarios');
    expect(document.activeElement).toBe(title);
  });

  it('annonce un message dans la région aria-live commune', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      TestBed.inject(Announcer).announce('Partie déplacée : créneau 2, table Dragon.');
      vi.runAllTimers();
      fixture.detectChanges();

      const live = (fixture.nativeElement as HTMLElement).querySelector('[aria-live="polite"]');
      expect(live?.textContent).toBe('Partie déplacée : créneau 2, table Dragon.');
    } finally {
      vi.useRealTimers();
    }
  });
});
