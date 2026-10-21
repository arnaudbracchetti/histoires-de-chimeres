import { endpoint } from './endpoint.js';

export type ConventionDto = {
  id: string;
  name: string;
};

export const conventionEndpoints = {
  read: endpoint<ConventionDto>('GET', 'convention'),
};
