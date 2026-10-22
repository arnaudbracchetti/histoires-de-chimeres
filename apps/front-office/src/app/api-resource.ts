import { httpResource, type HttpResourceRef } from '@angular/common/http';
import {
  apiUrl,
  type Endpoint,
  type ParamsArgs,
  type ParamsOf,
  type ResponseOf,
} from '@chimeres/contract';

/**
 * `httpResource` d'un endpoint de l'API : l'URL et le type de la réponse viennent de son descripteur.
 * Un endpoint à paramètres de chemin les reçoit par une fonction, relue à chaque changement.
 */
export function apiResource<E extends Endpoint<unknown, unknown, never>>(
  endpoint: E,
  ...[params]: [ParamsOf<E>] extends [never] ? [] : [params: () => ParamsOf<E>]
): HttpResourceRef<ResponseOf<E> | undefined> {
  return httpResource<ResponseOf<E>>(() => apiUrl(endpoint, ...([params?.()] as ParamsArgs<E>)));
}
