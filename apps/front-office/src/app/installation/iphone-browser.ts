/**
 * Le navigateur de l'iPhone, pour le guide d'ajout à l'écran d'accueil : « Partager » n'est pas au
 * même endroit dans Safari, Chrome et Firefox. Un autre navigateur prend le chemin de Safari.
 */
export type IPhoneBrowser = 'safari' | 'chrome' | 'firefox';

/** Chrome écrit « CriOS » dans son user agent, Firefox « FxiOS ». */
export function readIPhoneBrowser(userAgent: string): IPhoneBrowser {
  if (/CriOS\//.test(userAgent)) return 'chrome';
  if (/FxiOS\//.test(userAgent)) return 'firefox';
  return 'safari';
}

/** Le nom du navigateur, tel qu'on l'écrit dans un texte. */
export const IPHONE_BROWSER_NAMES: Record<IPhoneBrowser, string> = {
  safari: 'Safari',
  chrome: 'Chrome',
  firefox: 'Firefox',
};
