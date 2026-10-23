import { computed, Injectable } from '@angular/core';
import { conventionEndpoints, type ConventionDto, type Endpoint } from '@chimeres/contract';
import { apiResource } from '../api-resource';
import { injectApiCall, type CallOptions } from '../api-call';

/** La convention, lue une fois et partagée : le rail suit aussitôt ce que la page enregistre. */
@Injectable({ providedIn: 'root' })
export class ConventionStore {
  readonly convention = apiResource(conventionEndpoints.read);
  /** Les créneaux, dans l'ordre de la journée ; aucun tant que la convention n'est pas lue. */
  readonly timeSlots = computed(() =>
    this.convention.hasValue() ? this.convention.value().timeSlots : [],
  );
  private readonly apiCall = injectApiCall();

  /**
   * Écrit par un endpoint qui renvoie la convention, puis la partage. Une erreur HTTP rejette la
   * promesse, comme `apiCall()`, et la convention partagée reste celle d'avant.
   */
  async write<E extends Endpoint<ConventionDto, unknown, unknown>>(
    endpoint: E,
    ...options: {} extends CallOptions<E> ? [options?: CallOptions<E>] : [options: CallOptions<E>]
  ): Promise<ConventionDto> {
    const convention = (await this.apiCall(endpoint, ...options)) as ConventionDto;
    this.convention.set(convention);
    return convention;
  }
}
