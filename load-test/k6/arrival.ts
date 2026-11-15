// La phase d'arrivée (docs/load-test/plan.md § 3 et 4).
import exec from 'k6/execution';
import { sleep } from 'k6';
import {
  prepareRequest,
  sendAndReadResponse,
  sendAndVerifySuccess,
  sendInParallelAndReadResponses,
  sendInParallelAndVerifySuccess,
} from './api.ts';
import type {
  FrontOfficeScheduleDto,
  ParticipantSituationDto,
} from '../../packages/contract/dist/index.js';
import { frontOffice, linkedPhone, pushSubscription } from './endpoints.ts';
import { FAKE_PUSH_URL, requestFakePushSubscription } from './fake-push.ts';
import type { PreparedConvention } from './preparation.ts';

export const ARRIVAL = 'arrival';
/** Durée de la montée : les téléphones arrivent un par un, régulièrement, sur 2 minutes. */
export const ARRIVAL_SECONDS = 120;
/** Statut de `phone-not-linked` : la lecture du lien, avant `link`. */
const PHONE_NOT_LINKED = 401;

/** Ce que rend une lecture : le programme et la situation du pseudo. */
export type Reading = { schedule: FrontOfficeScheduleDto; situation: ParticipantSituationDto };

/** Le rang du téléphone dans le test, à partir de 0 : un utilisateur virtuel k6 par téléphone. */
export function getPhoneIndex(): number {
  return exec.vu.idInTest - 1;
}

/**
 * Un téléphone arrive : il ouvre l'application, donne le code de présence, saisit son pseudo, se
 * relie, s'abonne au push, puis fait sa première lecture, qu'il rend. Un téléphone sur dix saisit
 * le pseudo d'un MJ et confirme.
 */
export function arrive(data: PreparedConvention, phoneCount: number): Reading {
  const phoneIndex = getPhoneIndex();
  sleep((phoneIndex * ARRIVAL_SECONDS) / phoneCount);

  openApplication();
  sendAndVerifySuccess(frontOffice.verifyPresenceCode, {
    phase: ARRIVAL,
    body: { presenceCode: data.presenceCode },
  });
  sleep(5 + Math.random() * 10);

  linkPhone(ARRIVAL, data, phoneIndex);
  sendAndVerifySuccess(linkedPhone.read, { phase: ARRIVAL });
  subscribeToPush();
  return readScheduleAndSituation(ARRIVAL);
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

/**
 * S'identifier : un téléphone sur dix saisit le pseudo d'un MJ, qui demande la confirmation
 * `game-master`, puis un second `link`. Les autres prennent un pseudo de joueur neuf.
 */
export function linkPhone(phase: string, data: PreparedConvention, phoneIndex: number): void {
  const { presenceCode, gameMasterNicknames } = data;
  const isGameMaster = phoneIndex % 10 === 9;
  const nickname = isGameMaster
    ? gameMasterNicknames[Math.floor(phoneIndex / 10) % gameMasterNicknames.length]!
    : `Joueur ${String(phoneIndex + 1).padStart(3, '0')}`;
  const first = sendAndReadResponse(linkedPhone.link, {
    phase,
    body: { presenceCode, nickname, confirmation: null },
  });
  if (first.status === 'linked') return;
  if (!isGameMaster || first.confirmation !== 'game-master') {
    throw new Error(`${linkedPhone.link.name} : confirmation inattendue pour ${nickname}.`);
  }
  const confirmed = sendAndReadResponse(linkedPhone.link, {
    phase,
    body: { presenceCode, nickname, confirmation: 'game-master' },
  });
  if (confirmed.status !== 'linked') {
    throw new Error(`${linkedPhone.link.name} : ${nickname} n'est pas relié après confirmation.`);
  }
}

/**
 * L'abonnement au push, une fois le téléphone relié : fake-push le fabrique à la place du
 * navigateur, puis le téléphone le range sur l'API. Sans `FAKE_PUSH_URL`, rien.
 */
function subscribeToPush(): void {
  if (FAKE_PUSH_URL === null) return;
  sendAndVerifySuccess(pushSubscription.save, {
    phase: ARRIVAL,
    body: requestFakePushSubscription(FAKE_PUSH_URL, ARRIVAL),
  });
}

/** Une lecture, l'unité de charge du téléphone : le programme et la situation, en parallèle. */
export function readScheduleAndSituation(phase: string): Reading {
  const [schedule, situation] = sendInParallelAndReadResponses([
    prepareRequest(frontOffice.readSchedule, { phase }),
    prepareRequest(frontOffice.readSituation, { phase }),
  ]);
  return {
    schedule: schedule as FrontOfficeScheduleDto,
    situation: situation as ParticipantSituationDto,
  };
}
