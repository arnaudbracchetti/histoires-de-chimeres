import { endpoint } from './endpoint.js';

/** Longueur maximale d'un pseudo. Le domaine reprend cette borne. */
export const NICKNAME_MAX_LENGTH = 30;

/** Un MJ, dans la liste comme sur sa fiche. */
export type GameMasterDto = {
  id: string;
  /** Le pseudo tel qu'il a été saisi. */
  nickname: string;
  /** Les identifiants des créneaux où le MJ est disponible, dans l'ordre de la journée (PR-2). */
  availabilities: string[];
};

/** Pseudo d'un MJ. Corps de la création et du changement de pseudo. */
export type GameMasterNicknameBody = {
  nickname: string;
};

export type GameMasterParams = { gameMasterId: string };

/**
 * La liste et la création renvoient les MJ dans l'ordre naturel de leur pseudo. La fiche ne lit
 * que le MJ : elle deviendra l'espace du MJ lui-même.
 */
export const gameMasterEndpoints = {
  list: endpoint<GameMasterDto[]>('GET', 'game-masters'),
  read: endpoint<GameMasterDto, GameMasterParams>('GET', 'game-masters/:gameMasterId'),
  add: endpoint<GameMasterDto[], never, GameMasterNicknameBody>('POST', 'game-masters'),
  rename: endpoint<GameMasterDto, GameMasterParams, GameMasterNicknameBody>(
    'PUT',
    'game-masters/:gameMasterId',
  ),
  remove: endpoint<void, GameMasterParams>('DELETE', 'game-masters/:gameMasterId'),
};
