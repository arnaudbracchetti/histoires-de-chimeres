import { describe, expect, it } from 'vitest';
import { apiUrl, endpoint } from './endpoint.js';

describe('apiUrl', () => {
  it('donne l’URL absolue d’un endpoint sans paramètre', () => {
    expect(apiUrl(endpoint<string>('GET', 'convention'))).toBe('/api/convention');
  });

  it('remplace chaque paramètre de chemin par sa valeur encodée', () => {
    const update = endpoint<string, { gameId: string; tableId: string }>(
      'PUT',
      'games/:gameId/tables/:tableId',
    );

    expect(apiUrl(update, { gameId: 'a/b', tableId: 'é 1' })).toBe(
      '/api/games/a%2Fb/tables/%C3%A9%201',
    );
  });

  it('exige les paramètres déclarés', () => {
    const remove = endpoint<string, { timeSlotId: string }>('DELETE', 'time-slots/:timeSlotId');

    // @ts-expect-error : les paramètres manquent.
    expect(() => apiUrl(remove)).toThrow(/timeSlotId/);
    // @ts-expect-error : un paramètre manque.
    expect(() => apiUrl(remove, {})).toThrow(/timeSlotId/);
  });
});
