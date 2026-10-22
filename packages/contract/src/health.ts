import { endpoint } from './endpoint.js';

export type HealthDto = {
  status: 'ok';
};

export const healthEndpoints = {
  check: endpoint<HealthDto>('GET', 'health'),
};
