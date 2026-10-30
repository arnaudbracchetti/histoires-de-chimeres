import { Routes } from '@angular/router';
import { frontOfficePaths } from '@chimeres/contract';
import { HomePage } from './pages/home-page';
import { MyGamesPage } from './pages/my-games-page';
import { SchedulePage } from './pages/schedule-page';

/**
 * Les onglets de la coquille (`TABS`), et la fiche d'une partie, qui s'affiche sans elle
 * (`sheet`), aux chemins de `contract`, où l'API prend aussi les adresses des notifications. Une
 * adresse inconnue retombe sur l'Accueil.
 */
export const routes: Routes = [
  { path: frontOfficePaths.home, component: HomePage, title: 'Histoires de Chimères' },
  { path: frontOfficePaths.schedule, component: SchedulePage, title: 'Programme — Histoires de Chimères' },
  { path: frontOfficePaths.myGames, component: MyGamesPage, title: 'Mes parties — Histoires de Chimères' },
  {
    path: frontOfficePaths.game,
    // À part : le Markdown de la présentation pèse. Le service worker précharge ce morceau.
    loadComponent: () => import('./game/game-page').then((m) => m.GamePage),
    title: 'Partie — Histoires de Chimères',
    data: { sheet: true },
  },
  { path: '**', redirectTo: '' },
];
