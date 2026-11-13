import { inject } from '@angular/core';
import { RedirectCommand, Router, type CanActivateFn } from '@angular/router';
import { AccountStore, MY_SHEET_PATH } from './account-store';

/** L'accueil du back office : le Calendrier pour un Organisateur, Ma fiche pour un MJ seul. */
export const homeForAccount: CanActivateFn = async () => {
  const router = inject(Router);
  const account = await inject(AccountStore).readSettledAccount();
  return account && !account.organizer ? router.parseUrl(MY_SHEET_PATH) : true;
};

/**
 * La fiche d'un MJ par son URL (`/mj/:id`) : sa propre fiche mène un MJ seul à Ma fiche, titrée et
 * présentée pour lui.
 */
export const ownSheetAsMySheet: CanActivateFn = async (route) => {
  const router = inject(Router);
  const account = await inject(AccountStore).readSettledAccount();
  const isOwnSheet = account && !account.organizer && account.gameMasterId === route.params['id'];
  return isOwnSheet ? router.parseUrl(MY_SHEET_PATH) : true;
};

/**
 * Une page réservée aux Organisateurs. Ouverte par URL par un MJ seul, elle cède la place à
 * « Accès refusé », sans changer l'URL. Sans session, la page s'ouvre : sa lecture renvoie à la
 * connexion (401).
 */
export const onlyOrganizers: CanActivateFn = async () => {
  const router = inject(Router);
  const account = await inject(AccountStore).readSettledAccount();
  if (!account || account.organizer) return true;
  return new RedirectCommand(router.parseUrl('/acces-refuse'), { skipLocationChange: true });
};
