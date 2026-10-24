import type { Locator, Page } from '@playwright/test';
import {
  apiUrl,
  gameMasterEndpoints,
  scenarioEndpoints,
  type GameMasterDto,
  type ScenarioBody,
  type ScenarioDto,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

// Espace insécable (U+00A0) et espace fine insécable (U+202F) de docs/design/ton.md.
const NBSP = ' ';
const THIN = ' ';

/** Crée un MJ par l'API. */
async function addGameMaster(page: Page, nickname: string): Promise<GameMasterDto> {
  const response = await page.request.post(apiUrl(gameMasterEndpoints.add), {
    data: { nickname },
  });
  expect(response.ok()).toBe(true);
  const gameMasters = (await response.json()) as GameMasterDto[];
  return gameMasters.find((gameMaster) => gameMaster.nickname === nickname)!;
}

/** Propose un scénario par l'API. */
async function proposeScenario(
  page: Page,
  gameMasterId: string,
  changes: Partial<ScenarioBody> = {},
): Promise<ScenarioDto> {
  const response = await page.request.post(apiUrl(scenarioEndpoints.propose, { gameMasterId }), {
    data: {
      title: "La Tour d'ébène",
      system: "L'Appel de Cthulhu",
      presentation: 'Une tour, une nuit.',
      contentWarnings: '',
      seats: { min: 3, max: 5 },
      duration: 1,
      ...changes,
    } satisfies ScenarioBody,
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ScenarioDto;
}

function form(page: Page) {
  return {
    title: page.getByRole('textbox', { name: 'Titre', exact: true }),
    system: page.getByRole('textbox', { name: 'Jeu', exact: true }),
    presentation: page.getByRole('textbox', { name: 'Présentation', exact: true }),
    contentWarnings: page.getByRole('textbox', { name: /^Avertissements de contenu/ }),
    min: page.getByRole('spinbutton', { name: 'Places minimum' }),
    max: page.getByRole('spinbutton', { name: 'Places maximum' }),
    twoSlots: page.getByRole('radio', { name: '2 créneaux' }),
    save: page.getByRole('button', { name: 'Enregistrer' }),
    write: page.getByRole('button', { name: 'Écrire', exact: true }),
    preview: page.getByRole('button', { name: 'Aperçu', exact: true }),
  };
}

/** Position dans la page, défilement compris : le focus au premier champ en erreur fait défiler. */
const positionOf = (locator: Locator) =>
  locator.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x: x + window.scrollX, y: y + window.scrollY, width, height };
  });

const leaveDialog = (page: Page) =>
  page.getByRole('alertdialog', { name: `Quitter sans enregistrer${THIN}?` });

test('proposer un scénario complet depuis la fiche du MJ (PR-1, PR-16)', async ({ page }) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  await page.goto(`/gestion/mj/${kairos.id}`);
  await expect(page.getByText("Aucun scénario pour l'instant.")).toBeVisible();

  await page.getByRole('link', { name: 'Proposer un scénario' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nouveau scénario' })).toBeFocused();
  await expect(page.getByRole('navigation', { name: "Fil d'Ariane" })).toHaveText(
    /MJ.*Kaïros.*Nouveau scénario/,
  );
  await expect(
    page.getByText("Tu pourras ajouter une image après l'enregistrement."),
  ).toBeVisible();
  const scenario = form(page);
  await scenario.title.fill("La Tour d'ébène");
  await scenario.system.fill("L'Appel de Cthulhu");
  await scenario.presentation.fill('Une tour, une nuit, **un secret**.');
  await scenario.contentWarnings.fill('Folie, huis clos');
  await scenario.min.fill('3');
  await scenario.max.fill('5');
  await scenario.twoSlots.check();
  await scenario.save.click();

  await expect(page).toHaveURL(/\/gestion\/scenarios\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: "La Tour d'ébène" })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Kaïros' })).toBeVisible();
  await page.reload();
  await expect(scenario.title).toHaveValue("La Tour d'ébène");
  await expect(scenario.system).toHaveValue("L'Appel de Cthulhu");
  await expect(scenario.presentation).toHaveValue('Une tour, une nuit, **un secret**.');
  await expect(scenario.contentWarnings).toHaveValue('Folie, huis clos');
  await expect(scenario.min).toHaveValue('3');
  await expect(scenario.max).toHaveValue('5');
  await expect(scenario.twoSlots).toBeChecked();

  await page.getByRole('link', { name: 'Kaïros' }).click();
  const item = page.getByRole('listitem').filter({ hasText: "La Tour d'ébène" });
  await expect(item).toContainText("L'Appel de Cthulhu");
  await expect(item).toContainText('3 à 5 places');
  await expect(item).toContainText('2 créneaux');
  // La lettrine ignore l'article : « La Tour d'ébène » → T.
  await expect(item.locator('app-scenario-illustration text')).toHaveText('T');
});

test('modifier un scénario : « Enregistré », puis le nouveau titre en tête de page (PR-14)', async ({
  page,
}) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  const { id } = await proposeScenario(page, kairos.id);
  await page.goto(`/gestion/scenarios/${id}`);
  const scenario = form(page);

  await scenario.title.fill('Les Chiens de la Vigne');
  await scenario.max.fill('6');
  await scenario.save.click();

  await expect(page.getByText('Enregistré', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Les Chiens de la Vigne' }),
  ).toBeVisible();
  await page.reload();
  await expect(scenario.title).toHaveValue('Les Chiens de la Vigne');
  await expect(scenario.max).toHaveValue('6');
});

test('erreurs locales au départ du champ, focus au premier champ en erreur, rien ne bouge', async ({
  page,
}) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  await page.goto(`/gestion/mj/${kairos.id}/nouveau-scenario`);
  const scenario = form(page);
  const save = await positionOf(scenario.save);
  const max = await positionOf(scenario.max);

  await scenario.title.fill('a'.repeat(81));
  await expect(scenario.title).toHaveAccessibleDescription('81 / 80');
  await scenario.title.press('Tab');
  await expect(scenario.title).toHaveAccessibleDescription(
    `81 / 80 Le titre fait 80 caractères au plus${NBSP}: raccourcis-le.`,
  );
  await scenario.title.fill("La Tour d'ébène");
  await expect(scenario.title).toHaveAccessibleDescription('15 / 80');

  await scenario.min.fill('5');
  await scenario.max.fill('3');
  await scenario.max.press('Tab');
  await expect(scenario.max).toHaveAccessibleDescription(
    `Le maximum est sous le minimum${NBSP}: augmente-le.`,
  );

  await scenario.save.click();
  await expect(scenario.system).toBeFocused();
  await expect(scenario.system).toHaveAccessibleDescription(/Indique le jeu du scénario\./);
  await expect(scenario.save).toBeEnabled();
  expect(await positionOf(scenario.save)).toEqual(save);
  expect(await positionOf(scenario.max)).toEqual(max);
});

test('les compteurs suivent la saisie', async ({ page }) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  await page.goto(`/gestion/mj/${kairos.id}/nouveau-scenario`);
  const scenario = form(page);

  await expect(scenario.title).toHaveAccessibleDescription('0 / 80');
  await scenario.system.fill('Dune');
  await expect(scenario.system).toHaveAccessibleDescription('4 / 60');
  await scenario.presentation.fill('a'.repeat(42));
  await expect(scenario.presentation).toHaveAccessibleDescription(/42 \/ 1\s500$/);
  await scenario.contentWarnings.fill('Folie');
  await expect(scenario.contentWarnings).toHaveAccessibleDescription('5 / 300');
});

test('l’aperçu rend le gras, l’italique et les listes, et laisse un lien tel quel', async ({
  page,
}) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  await page.goto(`/gestion/mj/${kairos.id}/nouveau-scenario`);
  const scenario = form(page);

  await scenario.presentation.fill(
    'Une **tour**, une *nuit*.\n\n- un indice\n- une fausse piste\n\n[site](https://exemple.fr)',
  );
  await scenario.preview.click();

  const preview = page.locator('app-presentation-preview');
  await expect(scenario.preview).toHaveAttribute('aria-pressed', 'true');
  await expect(scenario.presentation).toBeHidden();
  await expect(preview.locator('strong')).toHaveText('tour');
  await expect(preview.locator('em')).toHaveText('nuit');
  await expect(preview.getByRole('listitem')).toHaveText(['un indice', 'une fausse piste']);
  await expect(preview.getByRole('link')).toHaveCount(0);
  await expect(preview).toContainText('[site](https://exemple.fr)');

  await scenario.write.click();
  await expect(scenario.presentation).toBeVisible();
});

test('« Quitter sans enregistrer ? » : refusé, on reste ; accepté, on part', async ({ page }) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  const { id } = await proposeScenario(page, kairos.id);
  await page.goto(`/gestion/scenarios/${id}`);
  const scenario = form(page);
  const breadcrumb = page
    .getByRole('navigation', { name: "Fil d'Ariane" })
    .getByRole('link', { name: 'Scénarios' });

  // Sans modification, on part sans rien demander.
  await breadcrumb.click();
  await expect(page).toHaveURL(/\/gestion\/scenarios$/);
  await page.goBack();

  await scenario.title.fill('Titre changé');
  await breadcrumb.click();
  await expect(leaveDialog(page).getByRole('button', { name: 'Annuler' })).toBeFocused();
  await leaveDialog(page).getByRole('button', { name: 'Annuler' }).click();
  await expect(page).toHaveURL(new RegExp(`/gestion/scenarios/${id}$`));
  await expect(scenario.title).toHaveValue('Titre changé');

  await breadcrumb.click();
  await leaveDialog(page).getByRole('button', { name: 'Quitter sans enregistrer' }).click();
  await expect(page).toHaveURL(/\/gestion\/scenarios$/);
  await page.goto(`/gestion/scenarios/${id}`);
  await expect(scenario.title).toHaveValue("La Tour d'ébène");
});

test('lien profond vers un scénario', async ({ page }) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  const { id } = await proposeScenario(page, kairos.id, { title: 'Néons sur Neo-Paris' });

  await page.goto(`/gestion/scenarios/${id}`);

  await expect(page.getByRole('heading', { level: 1, name: 'Néons sur Neo-Paris' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: "Fil d'Ariane" })).toHaveText(
    /Scénarios.*Néons sur Neo-Paris/,
  );
  await expect(page).toHaveTitle('Scénario — Histoires de Chimères');
  await expect(form(page).title).toHaveValue('Néons sur Neo-Paris');

  await page.goto('/gestion/scenarios/8d3c1a8e-0000-4000-8000-000000000000');
  await expect(page.getByText("Ce scénario n'existe pas, ou plus.")).toBeVisible();
});

function scenarioList(page: Page) {
  const table = page.getByRole('table', { name: 'Scénarios de la convention' });
  return {
    table,
    /** Les titres affichés, dans l'ordre du tableau. */
    titles: table.locator('tbody th a'),
    sort: (column: string) => table.getByRole('button', { name: column, exact: true }),
    header: (column: string) => table.getByRole('columnheader', { name: column, exact: true }),
    filter: page.getByRole('searchbox', { name: 'Filtrer les scénarios' }),
  };
}

test('liste des scénarios : tri par colonne et filtre sans accent (PR-14)', async ({ page }) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  const elodie = await addGameMaster(page, 'Élodie');
  await proposeScenario(page, kairos.id, { title: 'Scénario 10', system: 'Pendragon' });
  await proposeScenario(page, elodie.id, {
    title: 'Scénario 2',
    system: 'Alien',
    seats: { min: 4, max: 4 },
    duration: 2,
  });
  await page.goto('/gestion/scenarios');
  const scenarios = scenarioList(page);

  await expect(scenarios.titles).toHaveText(['Scénario 2', 'Scénario 10']);
  await expect(scenarios.table.locator('tbody tr').first()).toContainText(
    /Scénario 2\s*Alien\s*Élodie\s*4\s+places\s*2\s+créneaux\s*0/,
  );
  await expect(scenarios.table.locator('tbody tr').first().locator('svg').first()).toBeVisible();
  await expect(scenarios.header('Titre')).toHaveAttribute('aria-sort', 'ascending');

  await scenarios.sort('Titre').click();
  await expect(scenarios.titles).toHaveText(['Scénario 10', 'Scénario 2']);
  await expect(scenarios.header('Titre')).toHaveAttribute('aria-sort', 'descending');
  await scenarios.sort('MJ').click();
  await expect(scenarios.titles).toHaveText(['Scénario 2', 'Scénario 10']);
  await scenarios.sort('Jeu').click();
  await expect(scenarios.titles).toHaveText(['Scénario 2', 'Scénario 10']);
  await scenarios.sort('Jeu').click();
  await expect(scenarios.titles).toHaveText(['Scénario 10', 'Scénario 2']);

  await scenarios.filter.fill('kairos');
  await expect(scenarios.titles).toHaveText(['Scénario 10']);
  await scenarios.filter.fill('ALIEN');
  await expect(scenarios.titles).toHaveText(['Scénario 2']);

  await scenarios.titles.first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Scénario 2' })).toBeVisible();
});

test('sans scénario, l’état vide renvoie vers les MJ', async ({ page }) => {
  await page.goto('/gestion/scenarios');

  await expect(page.getByText(/^Aucun scénario pour l'instant/)).toBeVisible();
  await page.getByRole('link', { name: 'Choisir un MJ' }).click();
  await expect(page).toHaveURL(/\/gestion\/mj$/);
});

test('supprimer un scénario depuis « ⋯ », après confirmation (PR-14)', async ({ page }) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  const { id } = await proposeScenario(page, kairos.id);
  await proposeScenario(page, kairos.id, { title: 'Zénith' });
  await page.goto(`/gestion/scenarios/${id}`);

  await page.getByRole('button', { name: 'Autres actions sur le scénario' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer le scénario' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: `Supprimer le scénario «${NBSP}La Tour d'ébène${NBSP}»${THIN}?`,
  });
  await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Supprimer le scénario' }).click();

  await expect(page).toHaveURL(/\/gestion\/scenarios$/);
  await expect(scenarioList(page).titles).toHaveText(['Zénith']);
});

test('un MJ qui a un scénario : la suppression est refusée dans le dialogue (PR-12)', async ({
  page,
}) => {
  const kairos = await addGameMaster(page, 'Kaïros');
  await proposeScenario(page, kairos.id);
  await page.goto(`/gestion/mj/${kairos.id}`);

  await page.getByRole('button', { name: 'Autres actions sur le MJ' }).click();
  await page.getByRole('menuitem', { name: 'Supprimer le MJ' }).click();
  const dialog = page.getByRole('alertdialog', {
    name: `Supprimer le MJ «${NBSP}Kaïros${NBSP}»${THIN}?`,
  });
  await dialog.getByRole('button', { name: 'Supprimer le MJ' }).click();

  await expect(dialog.getByRole('alert')).toHaveText(
    `Ce MJ a un scénario${NBSP}: supprime-le d'abord.`,
  );
  await expect(dialog.getByRole('button')).toHaveText(['Fermer']);
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Kaïros' })).toBeVisible();
});
