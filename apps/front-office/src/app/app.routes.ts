import { Routes } from '@angular/router';
import { HomePage } from './pages/home-page';
import { MyGamesPage } from './pages/my-games-page';
import { SchedulePage } from './pages/schedule-page';

/** Les onglets de la coquille (`TABS`). Une adresse inconnue retombe sur l'Accueil. */
export const routes: Routes = [
  { path: '', component: HomePage, title: 'Histoires de Chimères' },
  { path: 'programme', component: SchedulePage, title: 'Programme — Histoires de Chimères' },
  { path: 'mes-parties', component: MyGamesPage, title: 'Mes parties — Histoires de Chimères' },
  { path: '**', redirectTo: '' },
];
