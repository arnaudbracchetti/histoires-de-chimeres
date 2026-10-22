import type { Page } from '@playwright/test';

/** Charge une police de la charte dans la page et dit si elle a été trouvée. */
export function loadFont(page: Page, family: string) {
  return page.evaluate(async (f) => (await document.fonts.load(`1em "${f}"`)).length > 0, family);
}
