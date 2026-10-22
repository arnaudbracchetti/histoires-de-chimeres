import { expect, test } from '../../fixtures.js';
import { loadFont } from '../fonts.js';

test('le back office est servi sous /gestion/, sur le calendrier', async ({ page }) => {
  await page.goto('/gestion');

  await expect(page).toHaveURL(/\/gestion\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calendrier');
  await expect(page).toHaveTitle('Calendrier — Histoires de Chimères');
});

test('le rail montre la convention en cours, et mène à ses créneaux et tables', async ({
  page,
}) => {
  await page.goto('/gestion/');

  const convention = page.getByRole('link', { name: /date à fixer/ });
  await expect(convention).toBeVisible();
  await convention.click();

  await expect(page).toHaveURL(/\/gestion\/creneaux-et-tables$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Créneaux et tables');
});

test('le rail mène à chaque page de préparation, focus sur son h1', async ({ page }) => {
  await page.goto('/gestion/');
  const rail = page.getByRole('navigation', { name: 'Navigation principale' });

  for (const [entry, url] of [
    ['MJ', /\/gestion\/mj$/],
    ['Scénarios', /\/gestion\/scenarios$/],
    ['Créneaux et tables', /\/gestion\/creneaux-et-tables$/],
    ['Calendrier', /\/gestion\/$/],
  ] as const) {
    await rail.getByRole('link', { name: entry, exact: true }).click();

    await expect(page).toHaveURL(url);
    const title = page.getByRole('heading', { level: 1 });
    await expect(title).toHaveText(entry);
    await expect(title).toBeFocused();
    await expect(rail.getByRole('link', { name: entry, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }
});

test('les entrées du jour J sont grisées, « à venir »', async ({ page }) => {
  await page.goto('/gestion/');
  const rail = page.getByRole('navigation', { name: 'Navigation principale' });

  for (const entry of ['Pilotage du jour J', 'Participants']) {
    await expect(rail.getByText(entry)).toBeVisible();
    await expect(rail.getByRole('link', { name: new RegExp(entry) })).toHaveCount(0);
  }
  await expect(rail.getByText('à venir')).toHaveCount(2);
});

test('le rail replié le reste après un rechargement', async ({ page }) => {
  await page.goto('/gestion/');

  await page.getByRole('button', { name: 'Replier le rail' }).click();
  await page.reload();

  await expect(page.getByRole('button', { name: 'Déplier le rail' })).toBeVisible();
  // Replié, chaque entrée garde son nom accessible, et son libellé en infobulle.
  const scenarios = page.getByRole('link', { name: 'Scénarios', exact: true });
  await expect(scenarios).toBeVisible();
  await scenarios.hover();
  await expect(scenarios.getByText('Scénarios')).toBeVisible();
});

test("un lien profond recharge la page d'un scénario, avec son fil d'Ariane", async ({
  page,
}) => {
  await page.goto('/gestion/scenarios/s1');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Scénario');
  const trail = page.getByRole('navigation', { name: "Fil d'Ariane" });
  await trail.getByRole('link', { name: 'Scénarios' }).click();
  await expect(page).toHaveURL(/\/gestion\/scenarios$/);
});

test("un lien profond recharge la fiche d'un MJ", async ({ page }) => {
  await page.goto('/gestion/mj/m1');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fiche du MJ');
  await expect(page.getByRole('navigation', { name: "Fil d'Ariane" })).toContainText('MJ');
});

test("un lien profond recharge la page d'un nouveau scénario, sous la fiche de son MJ", async ({
  page,
}) => {
  await page.goto('/gestion/mj/m1/nouveau-scenario');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouveau scénario');
  const trail = page.getByRole('navigation', { name: "Fil d'Ariane" });
  await trail.getByRole('link', { name: 'Fiche du MJ' }).click();
  await expect(page).toHaveURL(/\/gestion\/mj\/m1$/);
});

test('une adresse inconnue retombe sur le calendrier', async ({ page }) => {
  await page.goto('/gestion/une/route');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Calendrier');
});

test('le back office sert ses polices sous /gestion/', async ({ page }) => {
  await page.goto('/gestion/');

  expect(await loadFont(page, 'Uncial Antiqua')).toBe(true);
  expect(await loadFont(page, 'Aldrich')).toBe(true);
});
