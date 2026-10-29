import { endpoint } from './endpoint.js';

/**
 * Le « oui » à « Ce pseudo existe déjà. Est-ce bien toi qui l'as créé ? » (`participant`, ID-1), ou
 * à « Es-tu bien ce MJ ? » (`game-master`, ID-3).
 */
export type IdentityConfirmationDto = 'participant' | 'game-master';

export type LinkPhoneBody = {
  /** Le code de présence gardé par le téléphone (ID-2). */
  presenceCode: string;
  /** Le pseudo tapé. */
  nickname: string;
  /** La confirmation donnée, ou `null` à la première saisie. */
  confirmation: IdentityConfirmationDto | null;
};

/**
 * Le verdict de « s'identifier » : le téléphone est relié, ou le pseudo existe et demande la
 * confirmation de son participant ou de son MJ. `nickname` est le pseudo tel qu'il s'affiche.
 */
export type LinkPhoneDto =
  | { status: 'linked'; nickname: string }
  | { status: 'confirmation-needed'; confirmation: IdentityConfirmationDto; nickname: string };

/** Le pseudo auquel le téléphone est relié. */
export type LinkedPhoneDto = {
  nickname: string;
};

/**
 * Le téléphone relié à un pseudo (ADR 0009). Le lien tient dans un cookie `HttpOnly`, posé par
 * `link` et effacé par `unlink`. Un téléphone relié à aucun pseudo est refusé par `read` avec
 * `phone-not-linked` : le front revient à l'identification.
 */
export const linkedPhoneEndpoints = {
  read: endpoint<LinkedPhoneDto>('GET', 'front-office/linked-phone'),
  /** S'identifier (ID-1) : refuse sans le code de présence (ID-2). */
  link: endpoint<LinkPhoneDto, never, LinkPhoneBody>('POST', 'front-office/linked-phone'),
  /** Changer de pseudo (ID-9) : coupe le lien de ce téléphone, sans effet s'il n'en a pas. */
  unlink: endpoint<void>('DELETE', 'front-office/linked-phone'),
};
