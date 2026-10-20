import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('affiche la convention gérée', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    TestBed.inject(HttpTestingController)
      .expectOne('/api/convention')
      .flush({ id: 'c1', name: 'Histoires de Chimères' });
    await fixture.whenStable();

    const titre = (fixture.nativeElement as HTMLElement).querySelector('h1');
    expect(titre?.textContent).toContain('Gestion — Histoires de Chimères');
  });
});
