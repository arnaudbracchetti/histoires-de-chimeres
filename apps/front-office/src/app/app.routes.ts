import { Routes } from '@angular/router';
import { HomePage } from './pages/home-page';
import { MyGamesPage } from './pages/my-games-page';
import { SchedulePage } from './pages/schedule-page';

/**
 * Les onglets de la coquille (`TABS`), et la fiche d'une partie, qui s'affiche sans elle
 * (`sheet`). Une adresse inconnue retombe sur l'Accueil.
 */
export const routes: Routes = [
  { path: '', component: HomePage, title: 'Histoires de Chimères' },
  { path: 'programme', component: SchedulePage, title: 'Programme — Histoires de Chimères' },
  { path: 'mes-parties', component: MyGamesPage, title: 'Mes parties — Histoires de Chimères' },
  {
    path: 'parties/:gameId',
    // À part : le Markdown de la présentation pèse. Le service worker précharge ce morceau.
    loadComponent: () => import('./game/game-page').then((m) => m.GamePage),
    title: 'Partie — Histoires de Chimères',
    data: { sheet: true },
  },
  { path: '**', redirectTo: '' },
];
