import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import type { ProblemDto } from '@chimeres/contract';

/**
 * Sans session, ou après sa fin, l'API répond 401 `not-logged-in` (ADR 0017) : le back office
 * renvoie alors à la page de connexion. Un mauvais mot de passe (401 `wrong-credentials`) reste à
 * la page qui l'a envoyé. L'erreur suit son cours, pour l'appelant.
 */
export const redirectToLoginWhenLoggedOut: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (isNotLoggedIn(error) && !router.url.startsWith('/connexion')) {
        void router.navigateByUrl('/connexion');
      }
      return throwError(() => error);
    }),
  );
};

function isNotLoggedIn(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 401) return false;
  return (error.error as Partial<ProblemDto> | null)?.code === 'not-logged-in';
}
