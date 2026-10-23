import { endpoint } from './endpoint.js';
import type { GameMasterDto } from './game-master.js';

export type AvailabilityParams = { gameMasterId: string; timeSlotId: string };

/**
 * Disponibilité d'un MJ sur un créneau (PR-2). Déclarer deux fois, ou retirer une disponibilité
 * absente, ne change rien. Chaque écriture renvoie la fiche du MJ.
 */
export const availabilityEndpoints = {
  declare: endpoint<GameMasterDto, AvailabilityParams>(
    'PUT',
    'game-masters/:gameMasterId/availabilities/:timeSlotId',
  ),
  withdraw: endpoint<GameMasterDto, AvailabilityParams>(
    'DELETE',
    'game-masters/:gameMasterId/availabilities/:timeSlotId',
  ),
};
