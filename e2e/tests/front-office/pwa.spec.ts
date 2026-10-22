import { expect, test, type Page } from '@playwright/test';

/** Attend que le service worker du front office contrôle la page. */
async function installServiceWorker(page: Page) {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

test('le service worker du front office laisse passer le back office', async ({ page }) => {
  await installServiceWorker(page);

  await page.goto('/gestion/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Gestion — Histoires de Chimères',
  );

  await page.reload();
  await expect(page).toHaveTitle('Gestion — Histoires de Chimères');
});

test('le front office se charge hors ligne', async ({ page, context }) => {
  await installServiceWorker(page);

  await context.setOffline(true);
  await page.reload();

  // L'application démarre depuis le cache ; l'API, elle, est injoignable.
  await expect(page).toHaveTitle('Histoires de Chimères');
  await expect(page.getByText('Impossible de charger la convention.')).toBeVisible();
});

test('le service worker précharge les polices', async ({ page }) => {
  await installServiceWorker(page);

  // Le groupe « app » (installMode: prefetch) les télécharge à l'installation, que la page s'en serve ou non.
  const prefetched = () =>
    page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        if (!name.includes(':app:')) continue;
        const cache = await caches.open(name);
        for (const request of await cache.keys()) urls.push(new URL(request.url).pathname);
      }
      return urls.filter((url) => url.endsWith('.woff2')).length;
    });
  await expect.poll(prefetched).toBe(2);
});
