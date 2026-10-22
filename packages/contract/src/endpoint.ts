/** Préfixe de toutes les routes de l'API : `/api/...`. */
export const API_PREFIX = 'api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Descripteur d'un endpoint de l'API, partagé par son controller et par les fronts.
 * `path` est relatif au préfixe. `Params` (paramètres de chemin) et `Body` (corps de requête)
 * restent à `never` tant qu'aucun endpoint n'en a besoin.
 */
export type Endpoint<Res, Params = never, Body = never> = {
  readonly method: HttpMethod;
  readonly path: string;
  /** Champ fantôme, jamais renseigné : il retient les types échangés, que lit `ResponseOf`. */
  readonly types?: { response: Res; params: Params; body: Body };
};

/** Type de la réponse d'un endpoint. */
export type ResponseOf<E> = E extends Endpoint<infer Res, unknown, unknown> ? Res : never;

/** Type du corps de requête d'un endpoint (`never` s'il n'en a pas). */
export type BodyOf<E> = E extends Endpoint<unknown, unknown, infer Body> ? Body : never;

export function endpoint<Res, Params = never, Body = never>(
  method: HttpMethod,
  path: string,
): Endpoint<Res, Params, Body> {
  return { method, path };
}

/**
 * URL d'un endpoint sans paramètre, par exemple `/api/convention`. Elle est absolue : le back
 * office est servi sous `/gestion/`, où une URL relative viserait `/gestion/api/...`.
 */
export function apiUrl(endpoint: Endpoint<unknown, never, unknown>): string {
  return `/${API_PREFIX}/${endpoint.path}`;
}
