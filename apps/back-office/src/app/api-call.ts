import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, type BodyOf, type Endpoint, type ResponseOf } from '@chimeres/contract';

/** Écriture vers un endpoint de l'API : méthode, URL, corps et type de la réponse viennent de son descripteur. */
export type ApiCall = <E extends Endpoint<unknown, never, unknown>>(
  endpoint: E,
  options: { body: BodyOf<E> },
) => Promise<ResponseOf<E>>;

/**
 * Renvoie `apiCall(endpoint, { body })`, à créer dans un contexte d'injection (champ d'un
 * composant) et à appeler ensuite n'importe où. Une erreur HTTP rejette la promesse avec la
 * `HttpErrorResponse`, que lit `readProblem()`.
 */
export function injectApiCall(): ApiCall {
  const http = inject(HttpClient);
  return (endpoint, { body }) =>
    firstValueFrom(
      http.request<ResponseOf<typeof endpoint>>(endpoint.method, apiUrl(endpoint), { body }),
    );
}
