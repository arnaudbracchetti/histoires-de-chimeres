import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiUrl, scheduleEndpoints } from '@chimeres/contract';
import { redirectToLoginWhenLoggedOut } from './redirect-to-login.interceptor';

describe('Session terminée', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([redirectToLoginWhenLoggedOut])),
        provideHttpClientTesting(),
      ],
    });
  });

  /** Lit le programme, que l'API refuse avec ce statut et ce corps ; l'erreur est rendue. */
  async function readScheduleRefusedByApi(status: number, body: object) {
    const url = apiUrl(scheduleEndpoints.read);
    const done = firstValueFrom(TestBed.inject(HttpClient).get(url)).catch(
      (error: unknown) => error,
    );
    TestBed.inject(HttpTestingController)
      .expectOne(url)
      .flush(body, { status, statusText: 'Erreur' });
    return done;
  }

  it('renvoie à la page de connexion sur un 401 « non connecté »', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const error = await readScheduleRefusedByApi(401, { code: 'not-logged-in', status: 401 });

    expect(navigate).toHaveBeenCalledWith('/connexion');
    expect(error).toMatchObject({ status: 401 });
  });

  it('laisse un mauvais mot de passe à la page qui l’a envoyé', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await readScheduleRefusedByApi(401, { code: 'wrong-credentials', status: 401 });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('laisse un 403 à la page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await readScheduleRefusedByApi(403, { code: 'access-denied', status: 403 });

    expect(navigate).not.toHaveBeenCalled();
  });
});
