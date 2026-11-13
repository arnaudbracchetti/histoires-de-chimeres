import { apiUrl, participantEndpoints, type AddedParticipantDto } from '@chimeres/contract';
import type { request } from './http.js';

/**
 * Crée un MJ par l'assistant « Créer un pseudo », seule façon de créer un MJ, et rend son
 * identifiant et celui de son participant.
 */
export async function addGameMaster(
  server: ReturnType<typeof request>,
  nickname: string,
): Promise<{ gameMasterId: string; participantId: string }> {
  const response = await server
    .post(apiUrl(participantEndpoints.add))
    .send({ nickname, roles: ['game-master'] })
    .expect(201);
  const { gameMasterId, participantId } = response.body as AddedParticipantDto;
  return { gameMasterId: gameMasterId!, participantId };
}
