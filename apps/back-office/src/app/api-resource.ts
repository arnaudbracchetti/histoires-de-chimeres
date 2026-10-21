import { httpResource, type HttpResourceRef } from '@angular/common/http';
import { apiUrl, type Endpoint, type ResponseOf } from '@chimeres/contract';

/** `httpResource` d'un endpoint de l'API : l'URL et le type de la réponse viennent de son descripteur. */
export function apiResource<E extends Endpoint<unknown>>(
  endpoint: E,
): HttpResourceRef<ResponseOf<E> | undefined> {
  return httpResource<ResponseOf<E>>(() => apiUrl(endpoint));
}
