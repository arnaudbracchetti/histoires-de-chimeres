import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { apiUrl, frontOfficeEndpoints, linkedPhoneEndpoints } from '@chimeres/contract';

/** Le `dataGroup` des lectures JSON du front office, dans `ngsw-config.json` (ADR 0011). */
const DATA_GROUP = 'front-office';

/** Les lectures propres au pseudo relié. Celle de la convention n'appartient à personne. */
const PERSONAL_READS = [linkedPhoneEndpoints.read, frontOfficeEndpoints.readSchedule];

/**
 * La copie hors ligne des données du pseudo, que garde le cache du service worker (ADR 0011). Elle
 * est oubliée quand le pseudo quitte le téléphone, pour ne jamais mélanger deux personnes (ID-8, ID-9).
 */
@Injectable({ providedIn: 'root' })
export class OfflineCopy {
  private readonly document = inject(DOCUMENT);

  /** Efface du cache du service worker les lectures propres au pseudo. Sans cache, rien à faire. */
  async forget(): Promise<void> {
    const caches = this.document.defaultView?.caches;
    if (!caches) return;
    const urls = PERSONAL_READS.map((read) => new URL(apiUrl(read), this.document.baseURI).href);
    // Le service worker nomme ce cache `ngsw:<scope>:<version>:data:<groupe>:cache`.
    const names = (await caches.keys()).filter((name) =>
      name.endsWith(`:data:${DATA_GROUP}:cache`),
    );
    for (const name of names) {
      const cache = await caches.open(name);
      await Promise.all(urls.map((url) => cache.delete(url, { ignoreVary: true })));
    }
  }
}
