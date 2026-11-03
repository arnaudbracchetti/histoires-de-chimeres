import { endpoint } from './endpoint.js';

/** Les paramètres de chemin d'un geste du tirage d'un créneau. */
export type DrawParams = { timeSlotId: string };

/** Les paramètres de chemin d'un geste du tirage sur une partie. */
export type DrawGameParams = { gameId: string };

/** Les paramètres de chemin d'un déplacement : le créneau du tirage et le participant. */
export type DrawParticipantParams = { timeSlotId: string; participantId: string };

/** Le corps d'un déplacement : la nouvelle partie du participant, ou `null` pour les non placés. */
export type MoveParticipantBody = { gameId: string | null };

/**
 * Les gestes du tirage d'un créneau, et ceux sur une partie, dans le tirage de son premier
 * créneau. Ils rendent 204 : la page relit le suivi.
 */
export const drawEndpoints = {
  launch: endpoint<void, DrawParams>('POST', 'time-slots/:timeSlotId/draw'),
  rerun: endpoint<void, DrawParams>('POST', 'time-slots/:timeSlotId/draw/rerun'),
  reopenSignUps: endpoint<void, DrawParams>('DELETE', 'time-slots/:timeSlotId/draw'),
  moveParticipant: endpoint<void, DrawParticipantParams, MoveParticipantBody>(
    'PUT',
    'time-slots/:timeSlotId/draw/participants/:participantId',
  ),
  cancelGame: endpoint<void, DrawGameParams>('PUT', 'games/:gameId/cancellation'),
  restoreGame: endpoint<void, DrawGameParams>('DELETE', 'games/:gameId/cancellation'),
};
