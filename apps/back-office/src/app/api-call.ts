import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  apiUrl,
  type BodyOf,
  type Endpoint,
  type ParamsArgs,
  type ParamsOf,
  type ResponseOf,
} from '@chimeres/contract';

/** Options d'un appel : `params` dès que l'endpoint en déclare, `body` dès qu'il a un corps. */
export type CallOptions<E> = ([ParamsOf<E>] extends [never]
  ? { params?: never }
  : { params: ParamsOf<E> }) &
  ([BodyOf<E>] extends [never] ? { body?: never } : { body: BodyOf<E> });

/** Écriture vers un endpoint de l'API : méthode, URL, corps et type de la réponse viennent de son descripteur. */
export type ApiCall = <E extends Endpoint<unknown, unknown, unknown>>(
  endpoint: E,
  // Les options ne sont facultatives que pour un endpoint sans paramètre ni corps.
  ...options: {} extends CallOptions<E> ? [options?: CallOptions<E>] : [options: CallOptions<E>]
) => Promise<ResponseOf<E>>;

/**
 * Renvoie `apiCall(endpoint, { params, body })`, à créer dans un contexte d'injection (champ d'un
 * composant) et à appeler ensuite n'importe où. Une erreur HTTP rejette la promesse avec la
 * `HttpErrorResponse`, que lit `readProblem()`.
 */
export function injectApiCall(): ApiCall {
  const http = inject(HttpClient);
  return (endpoint, ...[options]) => {
    const { params, body } = (options ?? {}) as { params?: unknown; body?: unknown };
    const url = apiUrl(endpoint, ...([params] as ParamsArgs<typeof endpoint>));
    return firstValueFrom(
      http.request<ResponseOf<typeof endpoint>>(endpoint.method, url, { body }),
    );
  };
}
