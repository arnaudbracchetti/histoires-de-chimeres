/** Préfixe de toutes les routes de l'API : `/api/...`. */
export const API_PREFIX = 'api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Descripteur d'un endpoint de l'API, partagé par son controller et par les fronts.
 * `path` est relatif au préfixe, ses paramètres s'écrivent `:param` (`time-slots/:timeSlotId`).
 * `Params` (paramètres de chemin) et `Body` (corps de requête) restent à `never` sans objet.
 */
export type Endpoint<Res, Params = never, Body = never> = {
  readonly method: HttpMethod;
  readonly path: string;
  /** Champ fantôme, jamais renseigné : il retient les types échangés, que lit `ResponseOf`. */
  readonly types?: { response: Res; params: Params; body: Body };
};

/** Type de la réponse d'un endpoint. */
export type ResponseOf<E> = E extends Endpoint<infer Res, unknown, unknown> ? Res : never;

/** Type des paramètres de chemin d'un endpoint (`never` s'il n'en a pas). */
export type ParamsOf<E> = E extends Endpoint<unknown, infer Params, unknown> ? Params : never;

/** Type du corps de requête d'un endpoint (`never` s'il n'en a pas). */
export type BodyOf<E> = E extends Endpoint<unknown, unknown, infer Body> ? Body : never;

/** Arguments de `apiUrl` après l'endpoint : ses paramètres, exigés dès qu'il en déclare. */
export type ParamsArgs<E> = [ParamsOf<E>] extends [never] ? [] : [params: ParamsOf<E>];

export function endpoint<Res, Params = never, Body = never>(
  method: HttpMethod,
  path: string,
): Endpoint<Res, Params, Body> {
  return { method, path };
}

/**
 * URL d'un endpoint, par exemple `/api/time-slots/42`, chaque `:param` remplacé par sa valeur
 * encodée. Elle est absolue : le back office est servi sous `/gestion/`, où une URL relative
 * viserait `/gestion/api/...`.
 */
export function apiUrl<E extends Endpoint<unknown, unknown, unknown>>(
  endpoint: E,
  ...[params]: ParamsArgs<E>
): string {
  const path = endpoint.path.replace(/:(\w+)/g, (_, name: string) => {
    const value = (params as Record<string, string> | undefined)?.[name];
    if (value === undefined) {
      throw new Error(`Paramètre de chemin manquant : ${name} (${endpoint.path})`);
    }
    return encodeURIComponent(value);
  });
  return `/${API_PREFIX}/${path}`;
}
