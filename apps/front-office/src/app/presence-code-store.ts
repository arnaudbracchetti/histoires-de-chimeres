import { Location } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { PRESENCE_CODE_PARAM } from '@chimeres/contract';

const STORAGE_KEY = 'presenceCode';

/**
 * Le code de présence du téléphone (ID-2), gardé d'une ouverture à l'autre. À l'ouverture par le
 * QR code, il le lit dans l'adresse, puis l'en efface, sans rien demander au serveur : Google
 * rejoue cette adresse juste après le scan.
 */
@Injectable({ providedIn: 'root' })
export class PresenceCodeStore {
  private readonly location = inject(Location);

  readonly code = signal<string | null>(stored());

  constructor() {
    const [path, query = ''] = this.location.path().split('?');
    const params = new URLSearchParams(query);
    const code = params.get(PRESENCE_CODE_PARAM);
    if (code === null) return;
    this.keep(code);
    params.delete(PRESENCE_CODE_PARAM);
    this.location.replaceState(params.size ? `${path}?${params}` : path!);
  }

  keep(code: string): void {
    this.code.set(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Stockage refusé (navigation privée) : le code ne vaut que pour cette ouverture.
    }
  }
}

function stored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
