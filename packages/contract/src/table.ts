import { endpoint } from './endpoint.js';
import type { ConventionDto } from './convention.js';

/** Longueur maximale du nom d'une table. Le domaine reprend cette borne. */
export const TABLE_NAME_MAX_LENGTH = 30;

/** Une table, telle que la lecture de la convention la renvoie. */
export type TableDto = {
  id: string;
  /** Le nom tel qu'il a été saisi. */
  name: string;
};

/** Nom d'une table. Corps de l'ajout et du renommage. */
export type TableNameBody = {
  name: string;
};

export type TableParams = { tableId: string };

/** Chaque écriture renvoie la convention, avec ses tables dans l'ordre naturel. */
export const tableEndpoints = {
  add: endpoint<ConventionDto, never, TableNameBody>('POST', 'tables'),
  rename: endpoint<ConventionDto, TableParams, TableNameBody>('PUT', 'tables/:tableId'),
  remove: endpoint<ConventionDto, TableParams>('DELETE', 'tables/:tableId'),
};
