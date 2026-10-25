import { Routes } from '@angular/router';
import { Arrival } from './arrival';
import { Control } from './control';
import { Offline } from './offline';
import { Phone } from './phone';
import { Screen } from './screen';

export const routes: Routes = [
  { path: '', component: Phone },
  { path: 'ecran/:n', component: Screen },
  { path: 'arrivee', component: Arrival },
  { path: 'hors-ligne', component: Offline },
  { path: 'pilotage', component: Control },
  { path: '**', redirectTo: '' },
];
