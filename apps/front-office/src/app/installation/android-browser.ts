/**
 * Le navigateur d'Android, pour le chemin du menu d'installation et celui des réglages des
 * notifications : Chrome, Samsung Internet et Firefox ne les placent pas au même endroit. Un autre
 * navigateur prend le chemin de Chrome.
 */
export type AndroidBrowser = 'chrome' | 'samsung' | 'firefox';

/** Samsung Internet écrit « SamsungBrowser » (avant « Chrome »), Firefox « Firefox ». */
export function readAndroidBrowser(userAgent: string): AndroidBrowser {
  if (/SamsungBrowser\//.test(userAgent)) return 'samsung';
  if (/Firefox\//.test(userAgent)) return 'firefox';
  return 'chrome';
}
