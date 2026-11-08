import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { computed, type Resource, type Signal } from '@angular/core';
import {
  apiUrl,
  type Endpoint,
  type ParamsArgs,
  type ParamsOf,
  type QueryOf,
  type ResponseOf,
} from '@chimeres/contract';

/**
 * `httpResource` d'un endpoint de l'API : l'URL et le type de la réponse viennent de son descripteur.
 * Un endpoint à paramètres de chemin les reçoit par une fonction, relue à chaque changement ; tant
 * qu'elle renvoie `undefined`, rien n'est lu.
 */
export function apiResource<E extends Endpoint<unknown, unknown, never>>(
  endpoint: E,
  ...[params]: [ParamsOf<E>] extends [never] ? [] : [params: () => ParamsOf<E> | undefined]
): HttpResourceRef<ResponseOf<E> | undefined> {
  return httpResource<ResponseOf<E>>(() => {
    if (!params) return apiUrl(endpoint, ...([] as unknown as ParamsArgs<E>));
    const values = params();
    return values && apiUrl(endpoint, ...([values] as ParamsArgs<E>));
  });
}

/**
 * `httpResource` d'un endpoint sans paramètre de chemin, à paramètres de requête (`?search=elo`) :
 * `query` est relue à chaque changement, et un paramètre `undefined` n'est pas envoyé.
 */
export function apiQueryResource<
  E extends Endpoint<unknown, never, never, Record<string, string | undefined>>,
>(endpoint: E, query: () => QueryOf<E>): HttpResourceRef<ResponseOf<E> | undefined> {
  return httpResource<ResponseOf<E>>(() => ({
    url: apiUrl(endpoint, ...([] as unknown as ParamsArgs<E>)),
    params: Object.fromEntries(
      Object.entries(query()).filter((entry): entry is [string, string] => entry[1] !== undefined),
    ),
  }));
}

/**
 * La valeur lue d'une ressource, ou `undefined` tant qu'il n'y en a pas : lecture en cours, ou
 * échec, où `value()` lèverait une erreur. À créer dans un champ.
 */
export function currentValue<T>(resource: Resource<T | undefined>): Signal<T | undefined> {
  return computed(() => (resource.hasValue() ? resource.value() : undefined));
}
