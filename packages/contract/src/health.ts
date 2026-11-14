import { endpoint } from './endpoint.js';

export type HealthDto = {
  status: 'ok';
  /** Le tag Git de l'image (`v1.2.3`), ou `dev` hors image. */
  version: string;
};

export const healthEndpoints = {
  check: endpoint<HealthDto>('GET', 'health', { access: 'public' }),
};
