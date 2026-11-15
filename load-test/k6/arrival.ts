// La phase d'arrivée (docs/load-test/plan.md § 3 et 4), sans push pour l'instant.
import exec from 'k6/execution';
import { sleep } from 'k6';
import {
  prepareRequest,
  sendAndReadResponse,
  sendAndVerifySuccess,
  sendInParallelAndVerifySuccess,
} from './api.ts';
import { frontOffice, linkedPhone, pushSubscription } from './endpoints.ts';
import type { PreparedConvention } from './preparation.ts';

export const ARRIVAL = 'arrival';
/** Durée de la montée : les téléphones arrivent un par un, régulièrement, sur 2 minutes. */
export const ARRIVAL_SECONDS = 120;
/** Statut de `phone-not-linked` : la lecture du lien, avant `link`. */
const PHONE_NOT_LINKED = 401;

/**
 * Un téléphone arrive : il ouvre l'application, donne le code de présence, saisit son pseudo, se
 * relie, puis fait sa première lecture. Un téléphone sur dix saisit le pseudo d'un MJ et confirme.
 */
export function arrive(data: PreparedConvention, phoneCount: number): void {
  const phoneIndex = exec.vu.idInTest - 1;
  sleep((phoneIndex * ARRIVAL_SECONDS) / phoneCount);

  openApplication();
  sendAndVerifySuccess(frontOffice.verifyPresenceCode, {
    phase: ARRIVAL,
    body: { presenceCode: data.presenceCode },
  });
  sleep(5 + Math.random() * 10);

  const isGameMaster = phoneIndex % 10 === 9;
  const nickname = isGameMaster
    ? data.gameMasterNicknames[Math.floor(phoneIndex / 10) % data.gameMasterNicknames.length]!
    : `Joueur ${String(phoneIndex + 1).padStart(3, '0')}`;
  linkPhone(data.presenceCode, nickname, isGameMaster);
  sendAndVerifySuccess(linkedPhone.read, { phase: ARRIVAL });
  readScheduleAndSituation(ARRIVAL);
}

/**
 * L'ouverture de l'application : la convention et le lien du téléphone en parallèle, puis la clé
 * publique du push. Le téléphone n'est pas encore relié : `phone-not-linked` est attendu.
 */
function openApplication(): void {
  sendInParallelAndVerifySuccess([
    prepareRequest(frontOffice.read, { phase: ARRIVAL }),
    prepareRequest(linkedPhone.read, { phase: ARRIVAL, expectedRefusals: [PHONE_NOT_LINKED] }),
  ]);
  sendAndVerifySuccess(pushSubscription.readPublicKey, { phase: ARRIVAL });
}

/** S'identifier : le pseudo d'un MJ demande la confirmation `game-master`, puis un second `link`. */
function linkPhone(presenceCode: string, nickname: string, isGameMaster: boolean): void {
  const first = sendAndReadResponse(linkedPhone.link, {
    phase: ARRIVAL,
    body: { presenceCode, nickname, confirmation: null },
  });
  if (first.status === 'linked') return;
  if (!isGameMaster || first.confirmation !== 'game-master') {
    throw new Error(`${linkedPhone.link.name} : confirmation inattendue pour ${nickname}.`);
  }
  const confirmed = sendAndReadResponse(linkedPhone.link, {
    phase: ARRIVAL,
    body: { presenceCode, nickname, confirmation: 'game-master' },
  });
  if (confirmed.status !== 'linked') {
    throw new Error(`${linkedPhone.link.name} : ${nickname} n'est pas relié après confirmation.`);
  }
}

/** Une lecture, l'unité de charge du téléphone : le programme et la situation, en parallèle. */
export function readScheduleAndSituation(phase: string): void {
  sendInParallelAndVerifySuccess([
    prepareRequest(frontOffice.readSchedule, { phase }),
    prepareRequest(frontOffice.readSituation, { phase }),
  ]);
}
