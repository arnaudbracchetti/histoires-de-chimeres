import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { apiUrl, conventionEndpoints, type ProblemDto } from '@chimeres/contract';
import { ConventionForm } from './convention-form';
import { ConventionStore } from './convention-store';

describe('ConventionForm', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(ConventionForm);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http
      .expectOne(apiUrl(conventionEndpoints.read))
      .flush({ id: 'c1', name: 'Histoires de Chimères', date: null });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const input = (label: string) =>
      [...host.querySelectorAll('label')].find((l) => l.textContent?.trim().startsWith(label))!
        .control as HTMLInputElement;
    const type = async (label: string, value: string) => {
      const field = input(label);
      field.value = value;
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    const save = async () => {
      host.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
      await fixture.whenStable();
    };
    const errorOf = (label: string) => {
      const ids = input(label).getAttribute('aria-describedby')?.split(' ') ?? [];
      return ids.map((id) => host.querySelector(`#${id}.error`)?.textContent?.trim()).find(Boolean);
    };
    const flush = async (body: object | null, status = 200) => {
      const request = http.expectOne(apiUrl(conventionEndpoints.update));
      if (status === 200) request.flush(body);
      else if (status === 0) request.error(new ProgressEvent('error'));
      else request.flush(body, { status, statusText: 'Erreur' });
      // La réponse reprend l'action de `submit()` au fil de plusieurs promesses.
      await new Promise((resolve) => setTimeout(resolve));
      await fixture.whenStable();
      return request.request;
    };
    return { fixture, host, http, input, type, save, errorOf, flush };
  }

  it('reprend le nom et la date de la convention', async () => {
    const { input } = await render();

    expect(input('Nom').value).toBe('Histoires de Chimères');
    expect(input('Date').value).toBe('');
  });

  it('écrit « date à fixer » tant que la date n’est pas fixée', async () => {
    const { host } = await render();

    expect(host.querySelector('.date')?.textContent).toBe('date à fixer');
  });

  it('marque la date comme facultative', async () => {
    const { host } = await render();

    const date = [...host.querySelectorAll('label')].find((l) => l.textContent?.includes('Date'));
    expect(date?.textContent).toContain('facultatif');
  });

  it('envoie le nom et la date, puis met à jour la convention partagée avec le rail', async () => {
    const { type, save, flush, host } = await render();

    await type('Nom', 'Chimères 2027');
    await type('Date', '2027-03-14');
    await save();
    const request = await flush({ id: 'c1', name: 'Chimères 2027', date: '2027-03-14' });

    expect(request.method).toBe('PUT');
    expect(request.body).toEqual({ name: 'Chimères 2027', date: '2027-03-14' });
    expect(TestBed.inject(ConventionStore).convention.value()).toEqual({
      id: 'c1',
      name: 'Chimères 2027',
      date: '2027-03-14',
    });
    expect(host.textContent).toContain('Enregistré');
    expect(host.querySelector('.date')?.textContent).toBe('dimanche 14 mars 2027');
  });

  it('envoie une date effacée comme null', async () => {
    const { type, save, flush } = await render();

    await type('Date', '');
    await save();
    const request = await flush({ id: 'c1', name: 'Histoires de Chimères', date: null });

    expect(request.body).toEqual({ name: 'Histoires de Chimères', date: null });
  });

  it('affiche une erreur locale sous le champ quand on le quitte', async () => {
    const { type, errorOf } = await render();

    await type('Nom', '');

    expect(errorOf('Nom')).toBe('Donne un nom à la convention.');
  });

  it("n'envoie rien s'il reste une erreur, et met le focus au premier champ en erreur", async () => {
    const { type, save, input, http, fixture } = await render();
    await type('Nom', '');
    input('Date').focus();

    await save();
    await fixture.whenStable();

    http.expectNone(apiUrl(conventionEndpoints.update));
    expect(document.activeElement).toBe(input('Nom'));
  });

  it("affiche sous le champ une erreur de l'API rattachée à ce champ", async () => {
    const { type, save, flush, errorOf, input } = await render();
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:convention-name-required',
      title: 'Nom obligatoire',
      status: 422,
      detail: 'Donne un nom à la convention.',
      code: 'convention-name-required',
      errors: [
        {
          field: 'name',
          code: 'convention-name-required',
          message: 'Donne un nom à la convention.',
        },
      ],
    };

    await type('Nom', '   ');
    await save();
    await flush(problem, 422);

    expect(errorOf('Nom')).toBe('Donne un nom à la convention.');
    expect(document.activeElement).toBe(input('Nom'));
  });

  it('affiche une erreur interne dans un bandeau, sans perdre la saisie', async () => {
    const { type, save, flush, host, input } = await render();
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:internal-error',
      title: 'Erreur interne',
      status: 500,
      code: 'internal-error',
    };

    await type('Nom', 'Chimères 2027');
    await save();
    await flush(problem, 500);

    expect(host.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      'Une erreur est survenue, réessaie.',
    );
    expect(input('Nom').value).toBe('Chimères 2027');
  });

  it('affiche le détail d’un conflit dans le bandeau', async () => {
    const { save, flush, host } = await render();
    const problem: ProblemDto = {
      type: 'urn:histoires-de-chimeres:problem:concurrent-modification',
      title: 'Modification simultanée',
      status: 409,
      detail: 'La convention a changé entre-temps : recharge la page, puis recommence.',
      code: 'concurrent-modification',
    };

    await save();
    await flush(problem, 409);

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'La convention a changé entre-temps',
    );
  });

  it('signale une coupure réseau dans le bandeau', async () => {
    const { save, flush, host } = await render();

    await save();
    await flush(null, 0);

    expect(host.querySelector('[role="alert"]')?.textContent?.trim()).toBe(
      "Pas de connexion\u00a0: rien n'a été enregistré.",
    );
  });
});
