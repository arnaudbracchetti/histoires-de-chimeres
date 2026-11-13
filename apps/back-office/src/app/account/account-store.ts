import { computed, Injectable } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, firstValueFrom } from 'rxjs';
import {
  accessLinkEndpoints,
  accountEndpoints,
  gameMasterEndpoints,
  type ChangeOwnPasswordBody,
  type ConnectedAccountDto,
  type Endpoint,
  type LogInBody,
  type ParamsArgs,
} from '@chimeres/contract';
import { canCall } from './can-call';
import { injectApiCall } from '../api-call';
import { apiResource, currentValue } from '../api-resource';

/** Le chemin de Ma fiche, la fiche du MJ connecté : son accueil. */
export const MY_SHEET_PATH = '/ma-fiche';

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
  /** La lecture est terminée, réussie ou non (sans session, elle échoue). */
  private readonly settled = computed(() =>
    ['resolved', 'local', 'error'].includes(this.account.status()),
  );
  private readonly settled$ = toObservable(this.settled);

  /**
   * Le compte, une fois sa lecture terminée : rien sans session. Pour un garde de route. Le signal
   * est lu d'abord : juste après `logIn()`, l'observable rejouerait encore l'état d'avant.
   */
  async readSettledAccount(): Promise<ConnectedAccountDto | undefined> {
    if (!this.settled()) await firstValueFrom(this.settled$.pipe(filter(Boolean)));
    return this.value();
  }

  /** Le compte connecté peut-il appeler cet endpoint ? Pour masquer un geste interdit. */
  can<E extends Endpoint<unknown, unknown, unknown, unknown>>(
    endpoint: E,
    ...params: ParamsArgs<E>
  ): boolean {
    return canCall(this.value(), endpoint, ...params);
  }

  /**
   * Le lien vers la fiche de ce MJ : Ma fiche pour le sien, `/mj/…` pour un Organisateur, rien si
   * le compte ne peut pas la lire (un autre MJ).
   */
  gameMasterLink(gameMasterId: string): string[] | undefined {
    if (this.isMine(gameMasterId)) return [MY_SHEET_PATH];
    return this.can(gameMasterEndpoints.read, { gameMasterId }) ? ['/mj', gameMasterId] : undefined;
  }

  /** Ce MJ est-il celui du compte connecté ? */
  isMine(gameMasterId: string): boolean {
    return gameMasterId === this.value()?.gameMasterId;
  }

  /** Se connecter. Une erreur HTTP rejette la promesse, comme `apiCall()`. */
  async logIn(body: LogInBody): Promise<void> {
    this.account.set(await this.apiCall(accountEndpoints.logIn, { body }));
  }

  /** Choisir son mot de passe par un lien d'accès : la personne est connectée (ADR 0018). */
  async choosePasswordByAccessLink(token: string, password: string): Promise<void> {
    this.account.set(
      await this.apiCall(accessLinkEndpoints.choosePassword, {
        params: { token },
        body: { password },
      }),
    );
  }

  /** Se déconnecter : la session est supprimée côté serveur. */
  async logOut(): Promise<void> {
    await this.apiCall(accountEndpoints.logOut);
    this.account.set(undefined);
  }

  /** Changer son mot de passe : ses autres sessions sont fermées, celle-ci reste ouverte. */
  async changePassword(body: ChangeOwnPasswordBody): Promise<void> {
    await this.apiCall(accountEndpoints.changePassword, { body });
  }
}
