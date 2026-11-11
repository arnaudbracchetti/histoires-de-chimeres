import { Routes } from '@angular/router';
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
 * de scénario, avec leur rendu Markdown, et la page du QR code se chargent à la demande.
 */
export const routes: Routes = [
  { path: '', title: 'Calendrier', component: CalendarPage },
  { path: 'mj', title: 'MJ', component: GameMastersPage },
  { path: 'mj/:id', title: 'Fiche du MJ', component: GameMasterPage },
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
  { path: 'creneaux-et-tables', title: 'Créneaux et tables', component: TimeSlotsAndTablesPage },
  { path: 'pilotage', title: 'Pilotage du jour J', component: SignUpTrackingPage },
  { path: 'participants', title: 'Participants', component: ParticipantsPage },
  { path: 'participants/:id', title: 'Fiche du pseudo', component: ParticipantPage },
  {
    path: 'informations-de-connexion',
    title: 'Informations de connexion',
    loadComponent: () => import('./poster/poster-page').then((m) => m.PosterPage),
  },
  { path: '**', redirectTo: '' },
];
