import { endpoint } from './endpoint.js';

/** Les paramètres de chemin d'un geste du tirage d'un créneau. */
export type DrawParams = { timeSlotId: string };

/** Les gestes du tirage d'un créneau. Ils rendent 204 : la page relit le suivi. */
export const drawEndpoints = {
  launch: endpoint<void, DrawParams>('POST', 'time-slots/:timeSlotId/draw'),
  rerun: endpoint<void, DrawParams>('POST', 'time-slots/:timeSlotId/draw/rerun'),
  reopenSignUps: endpoint<void, DrawParams>('DELETE', 'time-slots/:timeSlotId/draw'),
};
