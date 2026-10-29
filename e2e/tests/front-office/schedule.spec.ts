import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';
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
import { aNickname, identify } from './identification.js';

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
async function prepare(page: Page) {
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

const timeSlotChip = (page: Page, rank: number) =>
  page.getByRole('navigation', { name: 'Créneaux' }).getByRole('link', {
    name: new RegExp(`^Créneau ${rank}\\b`),
  });
/** L'onglet Programme, dans la barre du bas. */
const scheduleTab = (page: Page) =>
  page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Programme' });
const gameCard = (page: Page, title: string) => page.getByRole('link', { name: title });

test('le programme montre les parties créneau par créneau, une partie double sous ses deux créneaux (IN-3)', async ({
  page,
}) => {
  const { brann, brumes, epice } = await prepare(page);
  await identify(page, aNickname('Élodie'));

  await scheduleTab(page).click();
  await timeSlotChip(page, 1).click();

  await expect(timeSlotChip(page, 1)).toHaveAttribute('aria-current', 'true');
  const card = gameCard(page, brumes.title);
  await expect(card).toContainText(`Table ${brumes.tableName}`);
  await expect(card).toContainText(`L'Appel de Cthulhu · avec ${brann.nickname}`);
  await expect(card).toContainText(/Aucun inscrit · 5.places/);
  await expect(gameCard(page, epice.title)).toBeVisible();

  await timeSlotChip(page, 2).click();
  await expect(gameCard(page, epice.title)).toContainText('créneaux 1 et 2');
  await expect(gameCard(page, brumes.title)).toHaveCount(0);
});

test('la fiche d’une partie montre son contenu dans l’ordre du §5.3, puis revient au programme', async ({
  page,
}) => {
  const { kairos, brumes, epice } = await prepare(page);
  await identify(page, aNickname('Élodie'));
  await scheduleTab(page).click();
  await timeSlotChip(page, 1).click();

  await gameCard(page, brumes.title).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(brumes.title);
  await expect(page.getByText(/^Créneau 1 · \d.* · table /)).toBeVisible();
  await expect(page.getByText(/Aucun inscrit · 5.places/)).toBeVisible();
  const warnings = page.getByRole('region', { name: 'Avertissements de contenu' });
  await expect(warnings).toHaveText(/Noyade\./);
  await expect(page.locator('strong', { hasText: 'sous' })).toBeVisible();
  // Les avertissements de contenu se lisent avant la présentation (§5.3).
  const top = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!.y;
  expect(await top(warnings)).toBeLessThan(await top(page.getByText(/Une enquête/)));

  await page.getByRole('button', { name: 'Retour' }).click();
  await expect(timeSlotChip(page, 1)).toHaveAttribute('aria-current', 'true');

  await gameCard(page, epice.title).click();
  await expect(page.getByText(/^Créneaux 1 et 2 · \d/)).toBeVisible();
  await expect(page.getByText(`Dune · avec ${kairos.nickname}`)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Avertissements de contenu' })).toHaveCount(0);
});
