/** Préfixe de toutes les routes de l'API : `/api/...`. */
export const API_PREFIX = 'api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Niveau d'accès d'un endpoint (ADR 0017), lu par le garde global de l'API :
 * - `public` : ouvert à tous ;
 * - `linkedPhone` : un geste du téléphone relié, vérifié par sa commande (ADR 0009) ; le garde le
 *   laisse passer, et une session du back office n'y donne aucun droit (ID-3) ;
 * - `gameMaster` : une session de MJ ou d'Organisateur ;
 * - `ownGameMaster` : le MJ dont le chemin porte le `:gameMasterId`, ou un Organisateur ;
 * - `organizer` : un Organisateur, niveau d'un endpoint qui n'en déclare pas.
 */
export type EndpointAccess =
  'public' | 'linkedPhone' | 'gameMaster' | 'ownGameMaster' | 'organizer';

/**
 * Descripteur d'un endpoint de l'API, partagé par son controller et par les fronts.
 * `path` est relatif au préfixe, ses paramètres s'écrivent `:param` (`time-slots/:timeSlotId`).
 * `Params` (paramètres de chemin), `Body` (corps de requête) et `Query` (paramètres de requête,
 * `?search=elo`, tous textes) restent à `never` sans objet.
 */
export type Endpoint<Res, Params = never, Body = never, Query = never> = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly access: EndpointAccess;
  /** Champ fantôme, jamais renseigné : il retient les types échangés, que lit `ResponseOf`. */
  readonly types?: { response: Res; params: Params; body: Body; query: Query };
};

/** Type de la réponse d'un endpoint. */
export type ResponseOf<E> = E extends Endpoint<infer Res, unknown, unknown, unknown> ? Res : never;

/** Type des paramètres de chemin d'un endpoint (`never` s'il n'en a pas). */
export type ParamsOf<E> =
  E extends Endpoint<unknown, infer Params, unknown, unknown> ? Params : never;

/** Type du corps de requête d'un endpoint (`never` s'il n'en a pas). */
export type BodyOf<E> = E extends Endpoint<unknown, unknown, infer Body, unknown> ? Body : never;

/** Type des paramètres de requête d'un endpoint (`never` s'il n'en a pas). */
export type QueryOf<E> = E extends Endpoint<unknown, unknown, unknown, infer Query> ? Query : never;

/** Arguments de `apiUrl` après l'endpoint : ses paramètres, exigés dès qu'il en déclare. */
export type ParamsArgs<E> = [ParamsOf<E>] extends [never] ? [] : [params: ParamsOf<E>];

/** Un endpoint sans niveau d'accès est réservé aux Organisateurs : fermé tant qu'on ne l'ouvre pas. */
export function endpoint<Res, Params = never, Body = never, Query = never>(
  method: HttpMethod,
  path: string,
  { access = 'organizer' }: { access?: EndpointAccess } = {},
): Endpoint<Res, Params, Body, Query> {
  return { method, path, access };
}

/**
 * URL d'un endpoint, par exemple `/api/time-slots/42`, chaque `:param` remplacé par sa valeur
 * encodée. Elle est absolue : le back office est servi sous `/gestion/`, où une URL relative
 * viserait `/gestion/api/...`.
 */
export function apiUrl<E extends Endpoint<unknown, unknown, unknown, unknown>>(
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
