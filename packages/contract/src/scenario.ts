import { endpoint } from './endpoint.js';
import type { GameMasterParams } from './game-master.js';

/** Bornes du contenu d'un scénario (PR-1). Le domaine les reprend. */
export const SCENARIO_TITLE_MAX_LENGTH = 80;
export const SYSTEM_MAX_LENGTH = 60;
export const PRESENTATION_MAX_LENGTH = 1500;
export const CONTENT_WARNINGS_MAX_LENGTH = 300;

/** Places d'un scénario, MJ non compris : 1 ≤ min ≤ max. */
export type SeatsDto = { min: number; max: number };

/** Durée d'un scénario, en créneaux. */
export type DurationDto = 1 | 2;

/** Un scénario, tel que les listes le montrent : sans présentation. */
export type ScenarioSummaryDto = {
  id: string;
  title: string;
  system: string;
  seats: SeatsDto;
  duration: DurationDto;
  /** URL de l'image, ou `null` : le front dessine alors l'illustration par défaut (PR-7). */
  imageUrl: string | null;
};

/** Le MJ d'un scénario, fixé à sa création (PR-16). */
export type ScenarioGameMasterDto = { id: string; nickname: string };

/** Un scénario, dans la liste de tous les scénarios. */
export type ScenarioListItemDto = ScenarioSummaryDto & {
  gameMaster: ScenarioGameMasterDto;
  /** Nombre de parties programmées. */
  games: number;
};

/** Un scénario, sur sa page. */
export type ScenarioDto = ScenarioSummaryDto & {
  gameMaster: ScenarioGameMasterDto;
  /** En Markdown restreint : paragraphes, gras, italique et listes. */
  presentation: string;
  /** Vide sans avertissement. */
  contentWarnings: string;
};

/** Corps de la proposition et de la modification d'un scénario. */
export type ScenarioBody = {
  title: string;
  system: string;
  presentation: string;
  /** Vide sans avertissement. */
  contentWarnings: string;
  seats: SeatsDto;
  duration: DurationDto;
};

export type ScenarioParams = { scenarioId: string };

export type ScenarioImageParams = ScenarioParams & { imageId: string };

/** Poids maximal d'une image envoyée : 10 Mo (PR-7). */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * La liste est dans l'ordre naturel des titres. Proposer et modifier renvoient le scénario relu.
 * L'image a ses propres endpoints, sans `Body` typé (ADR 0007) : l'envoi est un multipart au champ
 * `image`, et renvoie le scénario relu, comme le retrait. La lecture répond en `image/webp`.
 */
export const scenarioEndpoints = {
  list: endpoint<ScenarioListItemDto[]>('GET', 'scenarios'),
  read: endpoint<ScenarioDto, ScenarioParams>('GET', 'scenarios/:scenarioId'),
  propose: endpoint<ScenarioDto, GameMasterParams, ScenarioBody>(
    'POST',
    'game-masters/:gameMasterId/scenarios',
  ),
  update: endpoint<ScenarioDto, ScenarioParams, ScenarioBody>('PUT', 'scenarios/:scenarioId'),
  remove: endpoint<void, ScenarioParams>('DELETE', 'scenarios/:scenarioId'),
  changeImage: endpoint<ScenarioDto, ScenarioParams>('PUT', 'scenarios/:scenarioId/image'),
  removeImage: endpoint<ScenarioDto, ScenarioParams>('DELETE', 'scenarios/:scenarioId/image'),
  readImage: endpoint<Uint8Array, ScenarioImageParams>(
    'GET',
    'scenarios/:scenarioId/images/:imageId',
  ),
};
