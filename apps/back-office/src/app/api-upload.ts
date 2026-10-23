import { HttpClient, HttpEventType, HttpXhrBackend } from '@angular/common/http';
import { inject } from '@angular/core';
import { filter, firstValueFrom, map, tap } from 'rxjs';
import {
  apiUrl,
  type Endpoint,
  type ParamsArgs,
  type ParamsOf,
  type ResponseOf,
} from '@chimeres/contract';

export type UploadOptions<E> = ([ParamsOf<E>] extends [never]
  ? { params?: never }
  : { params: ParamsOf<E> }) & {
  /** Le fichier, envoyé en multipart sous le nom `field`. */
  file: File;
  field: string;
  /** Appelé pendant l'envoi, de 0 à 1. */
  progress: (fraction: number) => void;
};

/** Envoi d'un fichier vers un endpoint de l'API, sans `Body` typé (ADR 0007). */
export type ApiUpload = <E extends Endpoint<unknown, unknown, never>>(
  endpoint: E,
  options: UploadOptions<E>,
) => Promise<ResponseOf<E>>;

/**
 * Renvoie `apiUpload(endpoint, { params, file, field, progress })`, l'appel dédié à côté
 * d'`apiCall()`, à créer dans un contexte d'injection. Il passe par XHR : `fetch`, le transport
 * des autres appels, ne suit pas la progression d'un envoi. Une erreur HTTP rejette la promesse
 * avec la `HttpErrorResponse`, que lit `readProblem()`.
 */
export function injectApiUpload(): ApiUpload {
  const http = new HttpClient(inject(HttpXhrBackend));
  return (endpoint, { params, file, field, progress }) => {
    const url = apiUrl(endpoint, ...([params] as ParamsArgs<typeof endpoint>));
    const body = new FormData();
    body.append(field, file);
    return firstValueFrom(
      http
        .request<ResponseOf<typeof endpoint>>(endpoint.method, url, {
          body,
          observe: 'events',
          reportProgress: true,
        })
        .pipe(
          tap((event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              progress(event.loaded / event.total);
            }
          }),
          filter((event) => event.type === HttpEventType.Response),
          map((response) => response.body as ResponseOf<typeof endpoint>),
        ),
    );
  };
}
