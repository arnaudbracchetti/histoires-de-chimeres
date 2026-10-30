import { expect, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';
import {
  apiUrl,
  availabilityEndpoints,
  conventionEndpoints,
  gameMasterEndpoints,
  scenarioEndpoints,
  scheduleEndpoints,
  tableEndpoints,
  timeSlotEndpoints,
  type ConventionDto,
  type GameMasterDto,
  type ScenarioBody,
  type ScenarioDto,
} from '@chimeres/contract';
import { aNickname } from './identification.js';

/**
 * Une écriture de préparation, qui doit réussir. Les tests du projet `mobile` écrivent en parallèle
 * dans la même convention : un 409 (verrou optimiste) se réessaie, le geste n'ayant rien changé.
 */
async function send<T>(call: () => Promise<APIResponse>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const response = await call();
    if (response.status() === 409 && attempt < 5) continue;
    expect(response.ok(), await response.text()).toBe(true);
    return (await response.json()) as T;
  }
}

/**
 * Les créneaux 1 et 2 de la convention, ajoutés s'ils manquent. La base du projet `mobile` n'est
 * jamais remise à zéro : on garde ceux qui y sont, et un créneau n'en chevauche jamais un autre.
 */
async function firstTwoTimeSlots(request: APIRequestContext): Promise<[string, string]> {
  for (let hour = 6; ; hour++) {
    const convention = await send<ConventionDto>(() =>
      request.get(apiUrl(conventionEndpoints.read)),
    );
    const [first, second] = convention.timeSlots;
    if (first && second) return [first.id, second.id];
    const at = (h: number) => `${String(h).padStart(2, '0')}:00`;
    // Refusé si l'heure est prise : l'heure suivante est essayée.
    await request.post(apiUrl(timeSlotEndpoints.add), {
      data: { start: at(hour), end: at(hour + 1) },
    });
  }
}

/**
 * Par l'API, sur des tables et des MJ propres au test : une partie simple au créneau 1, et une
 * partie double aux créneaux 1 et 2. Leurs titres sont propres au test.
 */
export async function prepare(page: Page) {
  const { request } = page;
  const [slot1, slot2] = await firstTwoTimeSlots(request);
  const gameMaster = async (timeSlotIds: string[]) => {
    const nickname = aNickname('MJ');
    const all = await send<GameMasterDto[]>(() =>
      request.post(apiUrl(gameMasterEndpoints.add), { data: { nickname } }),
    );
    const { id } = all.find((master) => master.nickname === nickname)!;
    for (const timeSlotId of timeSlotIds) {
      await send(() =>
        request.put(apiUrl(availabilityEndpoints.declare, { gameMasterId: id, timeSlotId })),
      );
    }
    return { id, nickname };
  };
  const schedule = async (gameMasterId: string, scenario: ScenarioBody) => {
    const { id: scenarioId } = await send<ScenarioDto>(() =>
      request.post(apiUrl(scenarioEndpoints.propose, { gameMasterId }), { data: scenario }),
    );
    const tableName = aNickname('Griffon');
    const convention = await send<ConventionDto>(() =>
      request.post(apiUrl(tableEndpoints.add), { data: { name: tableName } }),
    );
    const tableId = convention.tables.find((table) => table.name === tableName)!.id;
    await send(() =>
      request.post(apiUrl(scheduleEndpoints.schedule), {
        data: { scenarioId, timeSlotId: slot1, tableId },
      }),
    );
    return { title: scenario.title, tableName };
  };
  const brann = await gameMaster([slot1]);
  const kairos = await gameMaster([slot1, slot2]);
  const brumes = await schedule(brann.id, {
    title: aNickname('Les Brumes'),
    system: "L'Appel de Cthulhu",
    presentation: 'Une enquête **sous** la brume.',
    contentWarnings: 'Noyade.',
    seats: { min: 3, max: 5 },
    duration: 1,
  });
  const epice = await schedule(kairos.id, {
    title: aNickname("L'Épice"),
    system: 'Dune',
    presentation: 'Arrakis.',
    contentWarnings: '',
    seats: { min: 4, max: 6 },
    duration: 2,
  });
  return { brann, kairos, brumes, epice };
}

export const timeSlotChip = (page: Page, rank: number) =>
  page.getByRole('navigation', { name: 'Créneaux' }).getByRole('link', {
    name: new RegExp(`^Créneau ${rank}\\b`),
  });
/** L'onglet Programme, dans la barre du bas. */
export const scheduleTab = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Programme' });
export const gameCard = (page: Page, title: string) => page.getByRole('link', { name: title });
