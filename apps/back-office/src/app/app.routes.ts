import { Routes } from '@angular/router';
import { backOfficePaths } from '@chimeres/contract';
import { AccessDeniedPage } from './account/access-denied-page';
import { AccessLinkPage } from './account/access-link-page';
import { AccountPage } from './account/account-page';
import { LoginPage } from './account/login-page';
import { homeForAccount, onlyOrganizers, ownSheetAsMySheet } from './account/access-guards';
import { CalendarPage } from './schedule/calendar-page';
import { GameMasterPage } from './game-masters/game-master-page';
import { GameMastersPage } from './game-masters/game-masters-page';
import { ParticipantPage } from './participants/participant-page';
import { ParticipantsPage } from './participants/participants-page';
import { ScenariosPage } from './scenarios/scenarios-page';
import { SignUpTrackingPage } from './sign-up-tracking/sign-up-tracking-page';
import { TimeSlotsAndTablesPage } from './convention/time-slots-and-tables-page';
import { leaveUnsaved } from './shell/leave-unsaved';

/**
 * URL en français, sous /gestion/. Le `title` devient celui de l'onglet (app.config.ts). Les pages
 * de scénario, avec leur rendu Markdown, et la page du QR code se chargent à la demande. Une page
 * réservée aux Organisateurs porte `onlyOrganizers` ; « Ma fiche » est la fiche du MJ connecté.
 */
export const routes: Routes = [
  { path: '', title: 'Calendrier', component: CalendarPage, canActivate: [homeForAccount] },
  { path: 'connexion', title: 'Connexion', component: LoginPage },
  {
    path: backOfficePaths.accessLink,
    title: 'Choisis ton mot de passe',
    component: AccessLinkPage,
  },
  { path: 'mon-compte', title: 'Mon compte', component: AccountPage },
  { path: 'acces-refuse', title: 'Accès refusé', component: AccessDeniedPage },
  { path: 'ma-fiche', title: 'Ma fiche', component: GameMasterPage, data: { mine: true } },
  { path: 'mj', title: 'MJ', component: GameMastersPage, canActivate: [onlyOrganizers] },
  {
    path: 'mj/:id',
    title: 'Fiche du MJ',
    component: GameMasterPage,
    canActivate: [ownSheetAsMySheet],
  },
  {
    path: 'mj/:id/nouveau-scenario',
    title: 'Nouveau scénario',
    loadComponent: () => import('./scenarios/new-scenario-page').then((m) => m.NewScenarioPage),
    canDeactivate: [leaveUnsaved],
  },
  { path: 'scenarios', title: 'Scénarios', component: ScenariosPage },
  {
    path: 'scenarios/:id',
    title: 'Scénario',
    loadComponent: () => import('./scenarios/scenario-page').then((m) => m.ScenarioPage),
    canDeactivate: [leaveUnsaved],
  },
  {
    path: 'creneaux-et-tables',
    title: 'Créneaux et tables',
    component: TimeSlotsAndTablesPage,
    canActivate: [onlyOrganizers],
  },
  {
    path: 'pilotage',
    title: 'Pilotage du jour J',
    component: SignUpTrackingPage,
    canActivate: [onlyOrganizers],
  },
  {
    path: 'participants',
    title: 'Participants',
    component: ParticipantsPage,
    canActivate: [onlyOrganizers],
  },
  {
    path: 'participants/:id',
    title: 'Fiche du pseudo',
    component: ParticipantPage,
    canActivate: [onlyOrganizers],
  },
  {
    path: 'informations-de-connexion',
    title: 'Informations de connexion',
    loadComponent: () => import('./poster/poster-page').then((m) => m.PosterPage),
    canActivate: [onlyOrganizers],
  },
  { path: '**', redirectTo: '' },
];
