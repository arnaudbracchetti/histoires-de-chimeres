import { Routes } from '@angular/router';
import { CalendarPage } from './pages/calendar-page';
import { GameMasterPage } from './pages/game-master-page';
import { GameMastersPage } from './pages/game-masters-page';
import { NewScenarioPage } from './pages/new-scenario-page';
import { ScenarioPage } from './pages/scenario-page';
import { ScenariosPage } from './pages/scenarios-page';
import { TimeSlotsAndTablesPage } from './pages/time-slots-and-tables-page';

/** URL en français, sous /gestion/. Le `title` devient celui de l'onglet (app.config.ts). */
export const routes: Routes = [
  { path: '', title: 'Calendrier', component: CalendarPage },
  { path: 'mj', title: 'MJ', component: GameMastersPage },
  { path: 'mj/:id', title: 'Fiche du MJ', component: GameMasterPage },
  { path: 'mj/:id/nouveau-scenario', title: 'Nouveau scénario', component: NewScenarioPage },
  { path: 'scenarios', title: 'Scénarios', component: ScenariosPage },
  { path: 'scenarios/:id', title: 'Scénario', component: ScenarioPage },
  { path: 'creneaux-et-tables', title: 'Créneaux et tables', component: TimeSlotsAndTablesPage },
  { path: '**', redirectTo: '' },
];
