import type { ProblemCode, RefusalCode, RefusalParams } from '@chimeres/contract';

type ParamsOf<C extends ProblemCode> = C extends RefusalCode
  ? RefusalParams[C]
  : Record<string, never>;

type Message<P> = {
  /** Le motif, court : « Nom obligatoire ». */
  title: string;
  /** Ce qui s'est passé et quoi faire, avec les paramètres du refus. */
  detail: (params: P) => string;
  /** Champ du corps concerné, avec des points pour l'imbrication (`seats.min`). */
  field?: string;
  /** Statut HTTP d'un refus, 422 par défaut : 404 pour un élément inconnu. */
  status?: number;
};

/**
 * Les messages de l'API, en français, un par code (ADR 0008). Un code sans message ne compile pas.
 * Tutoiement et typographie de docs/design/ton.md : espace insécable devant « : ».
 */
/** Seul le 500 n'a pas de détail : tout autre code sans `detail` ne compile pas. */
type Catalogue = {
  [C in ProblemCode]: C extends 'internal-error'
    ? Omit<Message<never>, 'detail'>
    : Message<ParamsOf<C>>;
};

export const problemCatalogue: Catalogue = {
  'convention-name-required': {
    title: 'Nom obligatoire',
    detail: () => 'Donne un nom à la convention.',
    field: 'name',
  },
  'convention-name-too-long': {
    title: 'Nom trop long',
    detail: ({ max }) => `Le nom de la convention fait ${max} caractères au plus : raccourcis-le.`,
    field: 'name',
  },
  'time-slot-not-found': {
    title: 'Créneau introuvable',
    detail: () => "Ce créneau n'existe plus : recharge la page.",
    status: 404,
  },
  'time-slot-end-not-after-start': {
    title: 'Fin avant le début',
    detail: () => "La fin du créneau vient après son début : change l'une des deux heures.",
    field: 'end',
  },
  'time-slot-start-overlaps': {
    title: 'Chevauchement',
    detail: ({ rank }) => `Le début tombe pendant le créneau ${rank} : choisis une autre heure.`,
    field: 'start',
  },
  'time-slot-end-overlaps': {
    title: 'Chevauchement',
    detail: ({ rank }) => `Ce créneau empiète sur le créneau ${rank} : avance sa fin.`,
    field: 'end',
  },
  'malformed-request': {
    title: 'Requête illisible',
    detail: () => 'Le serveur ne comprend pas cette requête : recharge la page, puis recommence.',
  },
  'concurrent-modification': {
    title: 'Modification simultanée',
    detail: () => 'La convention a changé entre-temps : recharge la page, puis recommence.',
  },
  'internal-error': {
    title: 'Erreur interne',
  },
};
