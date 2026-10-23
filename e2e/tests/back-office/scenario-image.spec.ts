import type { Page } from '@playwright/test';
import sharp from 'sharp';
import {
  apiUrl,
  gameMasterEndpoints,
  IMAGE_MAX_BYTES,
  scenarioEndpoints,
  type GameMasterDto,
  type ScenarioDto,
} from '@chimeres/contract';
import { expect, test } from '../../fixtures.js';

const NBSP = ' ';
const THIN = ' ';

/** Une image unie, de la taille demandée. */
const anImage = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: '#2f5d62' } });

const jpeg = async (width: number, height: number) => ({
  name: 'image.jpg',
  mimeType: 'image/jpeg',
  buffer: await anImage(width, height).jpeg().toBuffer(),
});

/** Crée un MJ et son scénario « La Tour d'ébène » par l'API. */
async function aScenario(page: Page): Promise<ScenarioDto> {
  const added = await page.request.post(apiUrl(gameMasterEndpoints.add), {
    data: { nickname: 'Kaïros' },
  });
  const [gameMaster] = (await added.json()) as GameMasterDto[];
  const proposed = await page.request.post(
    apiUrl(scenarioEndpoints.propose, { gameMasterId: gameMaster!.id }),
    {
      data: {
        title: "La Tour d'ébène",
        system: "L'Appel de Cthulhu",
        presentation: 'Une tour, une nuit.',
        contentWarnings: '',
        seats: { min: 3, max: 5 },
        duration: 1,
      },
    },
  );
  expect(proposed.ok()).toBe(true);
  return (await proposed.json()) as ScenarioDto;
}

/** Envoie une image par l'API. */
async function sendImage(page: Page, scenarioId: string): Promise<ScenarioDto> {
  const response = await page.request.put(apiUrl(scenarioEndpoints.changeImage, { scenarioId }), {
    multipart: { image: await jpeg(900, 600) },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as ScenarioDto;
}

function zone(page: Page) {
  const preview = page.locator('app-scenario-image app-scenario-illustration');
  return {
    preview,
    image: preview.locator('img'),
    choose: page.getByRole('button', { name: 'Choisir une image' }),
    replace: page.getByRole('button', { name: 'Remplacer' }),
    remove: page.getByRole('button', { name: "Retirer l'image" }),
    progress: page.getByRole('progressbar', { name: "Envoi de l'image" }),
    error: page.locator('app-scenario-image [role=alert]'),
  };
}

/** Choisit un fichier par « Choisir une image » ou « Remplacer ». */
async function pick(
  page: Page,
  button: ReturnType<typeof zone>['choose'],
  file: Awaited<ReturnType<typeof jpeg>>,
) {
  const chooser = page.waitForEvent('filechooser');
  await button.click();
  await (await chooser).setFiles(file);
}

const naturalRatio = (image: ReturnType<typeof zone>['image']) =>
  image.evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);

test("envoyer une image : barre de progression, puis l'aperçu recadré en 3:2 (PR-7)", async ({
  page,
}) => {
  const { id } = await aScenario(page);
  await page.goto(`/gestion/scenarios/${id}`);
  const image = zone(page);
  await expect(page.getByText('JPEG, PNG, WebP ou AVIF, 10 Mo au plus.')).toBeVisible();
  // L'envoi est retenu un instant : la barre a le temps de s'afficher.
  await page.route('**/image', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.continue();
  });

  await pick(page, image.choose, await jpeg(2400, 800));

  await expect(image.progress).toBeVisible();
  await expect(image.progress).toBeHidden();
  await expect(image.image).toHaveAttribute('src', /\/api\/scenarios\/.+\/images\/.+/);
  await expect.poll(() => naturalRatio(image.image)).toBe(1.5);
  await expect(image.replace).toBeVisible();
  await page.reload();
  await expect.poll(() => naturalRatio(image.image)).toBe(1.5);
});

test('refuser une image trop lourde, puis un GIF, sous la zone', async ({ page }) => {
  const { id } = await aScenario(page);
  await page.goto(`/gestion/scenarios/${id}`);
  const image = zone(page);
  const [errorBox, zoneBox] = [image.error, page.locator('app-scenario-image .zone')];
  const before = await zoneBox.boundingBox();

  await pick(page, image.choose, {
    name: 'lourde.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.concat([(await jpeg(10, 10)).buffer, Buffer.alloc(IMAGE_MAX_BYTES)]),
  });
  await expect(errorBox).toHaveText(
    `L'image fait plus de 10${NBSP}Mo${NBSP}: choisis-en une plus légère.`,
  );
  expect(await zoneBox.boundingBox()).toEqual(before);

  await pick(page, image.choose, {
    name: 'anim.gif',
    mimeType: 'image/gif',
    buffer: await anImage(30, 20).gif().toBuffer(),
  });
  await expect(errorBox).toHaveText(/JPEG/);
  await expect(image.image).toHaveCount(0);
  await expect(image.preview.locator('text')).toHaveText('T');
});

test("remplacer l'image : une nouvelle URL", async ({ page }) => {
  const { id } = await aScenario(page);
  const { imageUrl } = await sendImage(page, id);
  await page.goto(`/gestion/scenarios/${id}`);
  const image = zone(page);
  await expect(image.image).toHaveAttribute('src', imageUrl!);

  await pick(page, image.replace, await jpeg(1200, 1800));

  await expect(image.image).not.toHaveAttribute('src', imageUrl!);
  await expect(image.image).toHaveAttribute('src', /\/images\//);
});

test("retirer l'image après confirmation : l'illustration par défaut et sa lettrine", async ({
  page,
}) => {
  const { id } = await aScenario(page);
  await sendImage(page, id);
  await page.goto(`/gestion/scenarios/${id}`);
  const image = zone(page);

  await image.remove.click();
  const dialog = page.getByRole('alertdialog', {
    name: `Retirer l'image du scénario «${NBSP}La Tour d'ébène${NBSP}»${THIN}?`,
  });
  await dialog.getByRole('button', { name: "Retirer l'image" }).click();

  await expect(dialog).toBeHidden();
  await expect(image.image).toHaveCount(0);
  // La lettrine ignore l'article : « La Tour d'ébène » → T.
  await expect(image.preview.locator('text')).toHaveText('T');
  await expect(image.choose).toBeVisible();
  await page.reload();
  await expect(image.preview.locator('text')).toHaveText('T');
});

test('la vignette du scénario dans la liste', async ({ page }) => {
  const { id } = await aScenario(page);
  const { imageUrl } = await sendImage(page, id);

  await page.goto('/gestion/scenarios');

  const row = page.getByRole('row').filter({ hasText: "La Tour d'ébène" });
  await expect(row.locator('app-scenario-illustration img')).toHaveAttribute('src', imageUrl!);
});

test("une image qui ne se charge pas laisse place à l'illustration par défaut", async ({
  page,
}) => {
  const { id } = await aScenario(page);
  await sendImage(page, id);
  await page.route('**/images/**', (route) => route.fulfill({ status: 503 }));

  await page.goto(`/gestion/scenarios/${id}`);

  await expect(zone(page).preview.locator('text')).toHaveText('T');
  await expect(page.locator('app-scenario-illustration img')).toHaveCount(0);
});
