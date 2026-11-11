import { Injectable } from '@angular/core';
import { accountEndpoints, type LogInBody } from '@chimeres/contract';
import { injectApiCall } from '../api-call';
import { apiResource, currentValue } from '../api-resource';

/**
 * Le compte de la personne connectée au back office (ADR 0015), lu une fois et partagé. Sans
 * session, sa lecture échoue (401) : `value()` reste vide.
 */
@Injectable({ providedIn: 'root' })
export class AccountStore {
  private readonly account = apiResource(accountEndpoints.read);
  private readonly apiCall = injectApiCall();
  /** Le compte connecté, ou rien : pas de session, ou lecture en cours. */
  readonly value = currentValue(this.account);

  /** Se connecter. Une erreur HTTP rejette la promesse, comme `apiCall()`. */
  async logIn(body: LogInBody): Promise<void> {
    this.account.set(await this.apiCall(accountEndpoints.logIn, { body }));
  }

  /** Se déconnecter : la session est supprimée côté serveur. */
  async logOut(): Promise<void> {
    await this.apiCall(accountEndpoints.logOut);
    this.account.set(undefined);
  }
}
