// Appels à l'API par les descripteurs de `contract` : aucune route en dur (ADR 0004).
import http, { type RefinedResponse, type ResponseType, type Params } from 'k6/http';
import {
  apiUrl,
  type BodyOf,
  type Endpoint,
  type ParamsArgs,
  type ResponseOf,
} from '../../packages/contract/dist/index.js';

type AnyEndpoint = Endpoint<unknown, unknown, unknown, unknown>;
type Response = RefinedResponse<ResponseType | undefined>;

/** Un descripteur et son nom, `frontOfficeEndpoints.read` : la valeur du tag `endpoint`. */
export type NamedEndpoint<E extends AnyEndpoint> = E & { readonly name: string };

/**
 * Donne à chaque descripteur d'un groupe le nom `<groupe>.<clé>`, pour le tag `endpoint`. Le
 * groupe est passé avec son nom tel qu'il est exporté par `contract`.
 */
export function nameEndpoints<G extends Record<string, AnyEndpoint>>(
  groupName: string,
  group: G,
): { [K in keyof G]: NamedEndpoint<G[K]> } {
  const named = {} as Record<string, NamedEndpoint<AnyEndpoint>>;
  for (const [key, endpoint] of Object.entries(group)) {
    named[key] = { ...endpoint, name: `${groupName}.${key}` };
  }
  return named as { [K in keyof G]: NamedEndpoint<G[K]> };
}

/** Méthodes qui écrivent : le garde CSRF exige `Sec-Fetch-Site: same-origin` (ADR 0019). */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Statuts admis par défaut : un succès. Tout autre statut compte dans `http_req_failed`. */
const SUCCESS_STATUSES = [{ min: 200, max: 299 }];

/** Ce qui accompagne un appel, en plus de ses paramètres de chemin. */
export type CallOptions<E extends AnyEndpoint> = {
  body?: BodyOf<E>;
  /** La phase du test (le tag `scenario` de k6), ou `preparation` dans `setup()`. */
  phase: string;
  /**
   * Les statuts d'un refus attendu, en plus des succès : ils ne comptent pas comme des erreurs
   * (un `linkedPhoneEndpoints.read` avant `link` répond 401, par exemple).
   */
  expectedRefusals?: number[];
};

/** Une requête prête à partir, avec l'endpoint qui la nomme. */
export type PreparedRequest = {
  endpointName: string;
  /** Les statuts des refus attendus : ils ne bloquent pas la suite du test. */
  expectedRefusals: number[];
  method: string;
  url: string;
  body: string | null;
  params: Params;
};

/** L'adresse du serveur visé, sans `/` final : `BASE_URL`, test2 par défaut. */
export const BASE_URL = (__ENV.BASE_URL ?? 'https://test2.nekbet.fr').replace(/\/$/, '');

/** Prépare l'appel d'un endpoint : URL par `apiUrl()`, tags `endpoint` et `scenario`. */
export function prepareRequest<E extends AnyEndpoint>(
  endpoint: NamedEndpoint<E>,
  options: CallOptions<E>,
  ...params: ParamsArgs<E>
): PreparedRequest {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (WRITE_METHODS.has(endpoint.method)) headers['Sec-Fetch-Site'] = 'same-origin';
  const body = options.body === undefined ? null : JSON.stringify(options.body);
  if (body !== null) headers['Content-Type'] = 'application/json';
  return {
    endpointName: endpoint.name,
    expectedRefusals: options.expectedRefusals ?? [],
    method: endpoint.method,
    url: `${BASE_URL}${apiUrl(endpoint, ...params)}`,
    body,
    params: {
      headers,
      tags: { endpoint: endpoint.name, scenario: options.phase },
      responseCallback: http.expectedStatuses(
        ...SUCCESS_STATUSES,
        ...(options.expectedRefusals ?? []),
      ),
    },
  };
}

/**
 * Envoie un appel dont la réussite est nécessaire à la suite du test, et rend le corps JSON de sa
 * réponse. Un échec arrête l'itération, avec le statut et le corps pour motif.
 */
export function sendAndReadResponse<E extends AnyEndpoint>(
  endpoint: NamedEndpoint<E>,
  options: CallOptions<E>,
  ...params: ParamsArgs<E>
): ResponseOf<E> {
  const request = prepareRequest(endpoint, options, ...params);
  const response = http.request(request.method, request.url, request.body, request.params);
  return readSuccessfulResponse(request.endpointName, response) as ResponseOf<E>;
}

/** Envoie un appel dont la réussite est nécessaire à la suite du test, sans lire sa réponse. */
export function sendAndVerifySuccess<E extends AnyEndpoint>(
  endpoint: NamedEndpoint<E>,
  options: CallOptions<E>,
  ...params: ParamsArgs<E>
): void {
  sendAndReadResponse(endpoint, options, ...params);
}

/**
 * Envoie plusieurs appels en parallèle, comme le front office (`Promise.all`), et vérifie la
 * réussite de chacun, refus attendus exceptés.
 */
export function sendInParallelAndVerifySuccess(requests: PreparedRequest[]): void {
  const responses = http.batch(
    requests.map(({ method, url, body, params }) => ({ method, url, body, params })),
  );
  responses.forEach((response, index) => {
    const request = requests[index]!;
    if (!request.expectedRefusals.includes(response.status)) {
      readSuccessfulResponse(request.endpointName, response);
    }
  });
}

function readSuccessfulResponse(endpointName: string, response: Response): unknown {
  if (response.status < 200 || response.status > 299) {
    throw new Error(`${endpointName} : ${response.status} ${String(response.body)}`);
  }
  return response.status === 204 ? undefined : response.json();
}
