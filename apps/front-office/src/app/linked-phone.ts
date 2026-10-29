import { computed, Injectable, linkedSignal } from '@angular/core';
import { linkedPhoneEndpoints } from '@chimeres/contract';
import { injectApiCall } from './api-call';
import { apiResource } from './api-resource';
import { readProblem } from './problem';

/**
 * Le pseudo auquel ce téléphone est relié (ADR 0009). Le lien tient dans un cookie que la page ne
 * lit pas : l'API le dit. Un téléphone relié à aucun pseudo revient à l'identification.
 */
@Injectable({ providedIn: 'root' })
export class LinkedPhone {
  private readonly apiCall = injectApiCall();
  private readonly linkedPhone = apiResource(linkedPhoneEndpoints.read);

  /** Le pseudo affiché : `undefined` tant que l'API ne l'a pas dit, `null` sans pseudo. */
  readonly nickname = linkedSignal<string | null | undefined>(() => {
    if (this.linkedPhone.hasValue()) return this.linkedPhone.value().nickname;
    const error = this.linkedPhone.error();
    return error && readProblem(error).code === 'phone-not-linked' ? null : undefined;
  });

  /** La lecture a échoué pour une autre raison qu'un téléphone relié à aucun pseudo. */
  readonly failed = computed(() => !!this.linkedPhone.error() && this.nickname() === undefined);

  /** Le téléphone vient d'être relié à ce pseudo. */
  linked(nickname: string): void {
    this.nickname.set(nickname);
  }

  /** Changer de pseudo (ID-9) : coupe le lien de ce téléphone, puis revient à l'identification. */
  async unlink(): Promise<void> {
    await this.apiCall(linkedPhoneEndpoints.unlink);
    this.nickname.set(null);
  }
}
