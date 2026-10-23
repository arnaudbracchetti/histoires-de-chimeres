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
  /** Statut HTTP, 422 par défaut : 404 pour un élément inconnu. */
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
  'time-slot-hours-locked': {
    title: 'Heures figées',
    detail: ({ rank, availabilities }) =>
      `${availabilities > 1 ? `${availabilities} MJ sont disponibles` : 'Un MJ est disponible'} sur le créneau ${rank} : ses heures ne changent plus. Pour les changer, supprime le créneau, puis recrée-le.`,
  },
  'table-not-found': {
    title: 'Table introuvable',
    detail: () => "Cette table n'existe plus : recharge la page.",
    status: 404,
  },
  'table-name-required': {
    title: 'Nom obligatoire',
    detail: () => 'Donne un nom à la table.',
    field: 'name',
  },
  'table-name-too-long': {
    title: 'Nom trop long',
    detail: ({ max }) => `Le nom d'une table fait ${max} caractères au plus : raccourcis-le.`,
    field: 'name',
  },
  'table-name-taken': {
    title: 'Nom déjà pris',
    detail: ({ name }) => `La table « ${name} » porte déjà ce nom : choisis-en un autre.`,
    field: 'name',
  },
  'game-master-not-found': {
    title: 'MJ introuvable',
    detail: () => "Ce MJ n'existe plus : recharge la page.",
    status: 404,
  },
  'nickname-required': {
    title: 'Pseudo obligatoire',
    detail: () => 'Donne un pseudo au MJ.',
    field: 'nickname',
  },
  'nickname-too-long': {
    title: 'Pseudo trop long',
    detail: ({ max }) => `Un pseudo fait ${max} caractères au plus : raccourcis-le.`,
    field: 'nickname',
  },
  'nickname-taken': {
    title: 'Pseudo déjà pris',
    detail: ({ nickname }) => `Le MJ « ${nickname} » porte déjà ce pseudo : choisis-en un autre.`,
    field: 'nickname',
  },
  'game-master-has-scenarios': {
    title: 'MJ avec des scénarios',
    detail: ({ scenarios }) =>
      scenarios > 1
        ? `Ce MJ a ${scenarios} scénarios : supprime-les d'abord.`
        : `Ce MJ a un scénario : supprime-le d'abord.`,
  },
  'scenario-not-found': {
    title: 'Scénario introuvable',
    detail: () => "Ce scénario n'existe plus : recharge la page.",
    status: 404,
  },
  'scenario-title-required': {
    title: 'Titre obligatoire',
    detail: () => 'Donne un titre au scénario.',
    field: 'title',
  },
  'scenario-title-too-long': {
    title: 'Titre trop long',
    detail: ({ max }) => `Le titre fait ${max} caractères au plus : raccourcis-le.`,
    field: 'title',
  },
  'system-required': {
    title: 'Jeu obligatoire',
    detail: () => 'Indique le jeu du scénario.',
    field: 'system',
  },
  'system-too-long': {
    title: 'Jeu trop long',
    detail: ({ max }) => `Le jeu fait ${max} caractères au plus : raccourcis-le.`,
    field: 'system',
  },
  'presentation-required': {
    title: 'Présentation obligatoire',
    detail: () => 'Présente le scénario en quelques lignes.',
    field: 'presentation',
  },
  'presentation-too-long': {
    title: 'Présentation trop longue',
    detail: ({ max }) =>
      `La présentation fait ${formatCount(max)} caractères au plus : raccourcis-la.`,
    field: 'presentation',
  },
  'content-warnings-too-long': {
    title: 'Avertissements trop longs',
    detail: ({ max }) =>
      `Les avertissements de contenu font ${max} caractères au plus : raccourcis-les.`,
    field: 'contentWarnings',
  },
  'seats-min-below-one': {
    title: 'Minimum trop bas',
    detail: () => 'Une partie accueille au moins un joueur : mets 1 place minimum ou plus.',
    field: 'seats.min',
  },
  'seats-out-of-order': {
    title: 'Places dans le désordre',
    detail: () => 'Le maximum est sous le minimum : augmente-le, ou baisse le minimum.',
    field: 'seats.max',
  },
  'malformed-request': {
    title: 'Requête illisible',
    detail: () => 'Le serveur ne comprend pas cette requête : recharge la page, puis recommence.',
  },
  'concurrent-modification': {
    title: 'Modification simultanée',
    detail: () => 'La convention a changé entre-temps : recharge la page, puis recommence.',
  },
  'image-too-large': {
    title: 'Image trop lourde',
    detail: () => "L'image fait plus de 10 Mo : choisis-en une plus légère.",
    status: 413,
  },
  'image-format-unsupported': {
    title: 'Format refusé',
    detail: () =>
      "Ce fichier n'est ni un JPEG, ni un PNG, ni un WebP, ni un AVIF : enregistre l'image en JPEG, puis recommence.",
    status: 415,
  },
  'image-unreadable': {
    title: 'Image illisible',
    detail: () =>
      "L'image est abîmée, ou dépasse 40 mégapixels : enregistre-la de nouveau en JPEG, plus petite, puis recommence.",
  },
  'image-not-found': {
    title: 'Image introuvable',
    detail: () => "Cette image n'existe plus : recharge la page.",
    status: 404,
  },
  'internal-error': {
    title: 'Erreur interne',
  },
};

/** « 1 500 » : espace fine insécable pour les milliers (docs/design/ton.md). */
function formatCount(count: number): string {
  return count.toLocaleString('fr-FR').replace(/\s/g, '\u202f');
}
