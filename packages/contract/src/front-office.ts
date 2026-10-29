import { endpoint } from './endpoint.js';

/** Paramètre de l'adresse du QR code de l'affiche, qui porte le code de présence : `/?code=K7M2`. */
export const PRESENCE_CODE_PARAM = 'code';

/** Ce que le front office lit à son ouverture, tant que la convention n'est pas terminée. */
export type FrontOfficeDto = {
  conventionName: string;
};

export type PresenceCodeBody = {
  /** Le code tapé, à la casse et aux espaces du début et de la fin près. */
  presenceCode: string;
};

/** Le front office se ferme à la fin de la convention : ses endpoints refusent alors avec `convention-ended`. */
export const frontOfficeEndpoints = {
  read: endpoint<FrontOfficeDto>('GET', 'front-office'),
  /** Vérifie le code de présence, sans rien changer : 204, ou `presence-code-wrong` (ID-2). */
  verifyPresenceCode: endpoint<void, never, PresenceCodeBody>('POST', 'front-office/presence-code'),
};
