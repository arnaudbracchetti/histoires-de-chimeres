import { Injectable } from '@angular/core';
import { conventionEndpoints } from '@chimeres/contract';
import { apiResource } from '../api-resource';

/** La convention, lue une fois et partagée : le rail suit aussitôt ce que la page enregistre. */
@Injectable({ providedIn: 'root' })
export class ConventionStore {
  readonly convention = apiResource(conventionEndpoints.read);
}
