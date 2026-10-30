import { computed, effect, inject, Injectable, linkedSignal } from '@angular/core';
import { linkedPhoneEndpoints } from '@chimeres/contract';
import { injectApiCall } from './api-call';
import { apiResource } from './api-resource';
import { OfflineCopy } from './offline-copy';
import { isNetworkFailure, readProblem } from './problem';

/**
 * Le pseudo auquel ce téléphone est relié (ADR 0009). Le lien tient dans un cookie que la page ne
 * lit pas : l'API le dit. Un téléphone relié à aucun pseudo revient à l'identification, et oublie
 * la copie hors ligne de l'ancien pseudo (ID-8, ID-9).
 */
@Injectable({ providedIn: 'root' })
export class LinkedPhone {
  private readonly apiCall = injectApiCall();
  private readonly linkedPhone = apiResource(linkedPhoneEndpoints.read);
  private readonly offlineCopy = inject(OfflineCopy);

  /** Le pseudo affiché : `undefined` tant que l'API ne l'a pas dit, `null` sans pseudo. */
  readonly nickname = linkedSignal<string | null | undefined>(() => {
    if (this.linkedPhone.hasValue()) return this.linkedPhone.value().nickname;
    const error = this.linkedPhone.error();
    return error && readProblem(error).code === 'phone-not-linked' ? null : undefined;
  });

  /** La lecture a échoué pour une autre raison qu'un téléphone relié à aucun pseudo. */
  readonly failed = computed(() => !!this.linkedPhone.error() && this.nickname() === undefined);

  /** La lecture a échoué faute de réseau, sans copie hors ligne. */
  readonly offline = computed(() => this.failed() && isNetworkFailure(this.linkedPhone.error()));

  constructor() {
    effect(() => {
      if (this.nickname() === null) void this.offlineCopy.forget();
    });
  }

  /**
   * Le téléphone vient d'être relié à ce pseudo. Il relit son lien, pour que le service worker en
   * garde la copie : l'application s'ouvrira hors ligne.
   */
  linked(nickname: string): void {
    this.nickname.set(nickname);
    void this.apiCall(linkedPhoneEndpoints.read).catch(() => undefined);
  }

  /** Le serveur ne connaît plus le lien de ce téléphone : retour à l'identification (ID-8). */
  unlinkedByServer(): void {
    this.nickname.set(null);
  }

  /** Changer de pseudo (ID-9) : coupe le lien de ce téléphone, puis revient à l'identification. */
  async unlink(): Promise<void> {
    await this.apiCall(linkedPhoneEndpoints.unlink);
    this.nickname.set(null);
  }
}
