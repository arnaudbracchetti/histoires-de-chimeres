import type {
  ProblemCode,
  RefusalCode,
  RefusalParams,
  VerdictRefusalDto,
} from '@chimeres/contract';
import type { Refusal } from '@chimeres/domain';
import { countOf, formatCount, fr } from '@chimeres/design';

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
  'convention-ended': {
    title: 'La convention est terminée',
    detail: () => "L'application ne sert plus depuis la fin du dernier créneau.",
    status: 410,
  },
  'presence-code-wrong': {
    title: 'Code incorrect',
    detail: () => "Ce code ne correspond pas. Vérifie-le sur l'affiche, sous le QR code.",
    field: 'presenceCode',
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
      fr`${availabilities > 1 ? `${availabilities} MJ sont disponibles` : 'Un MJ est disponible'} sur le créneau ${rank} : ses heures ne changent plus. Pour les changer, supprime le créneau, puis recrée-le.`,
  },
  'time-slot-hours-locked-by-games': {
    title: 'Heures figées',
    detail: ({ rank, games }) =>
      fr`Le créneau ${rank} porte ${games > 1 ? `${games} parties` : 'une partie'} : ses heures ne changent plus. Pour les changer, déprogramme-${games > 1 ? 'les' : 'la'}, supprime le créneau, puis recrée-le.`,
  },
  'time-slot-has-games': {
    title: 'Créneau programmé',
    detail: ({ rank, games }) =>
      fr`Le créneau ${rank} porte ${games > 1 ? `${games} parties` : 'une partie'} : déprogramme-${games > 1 ? 'les' : 'la'} d'abord.`,
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
  'table-has-games': {
    title: 'Table programmée',
    detail: ({ name, games }) =>
      fr`La table « ${name} » porte ${games > 1 ? `${games} parties` : 'une partie'} : déprogramme-${games > 1 ? 'les' : 'la'} d'abord.`,
  },
  'game-master-not-found': {
    title: 'MJ introuvable',
    detail: () => "Ce MJ n'existe plus : recharge la page.",
    status: 404,
  },
  'participant-not-found': {
    title: 'Pseudo introuvable',
    detail: () => fr`Ce pseudo n'existe plus : tape-le à nouveau.`,
    status: 404,
  },
  'participant-is-game-master': {
    title: 'Pseudo de MJ',
    detail: ({ nickname }) =>
      fr`${nickname} est MJ : son pseudo se gère depuis sa fiche de MJ, dans « MJ ».`,
  },
  'merge-into-itself': {
    title: 'Même pseudo',
    detail: () => 'Choisis un autre pseudo que celui à fusionner.',
  },
  'nickname-required': {
    title: 'Pseudo obligatoire',
    detail: () => 'Tape un pseudo.',
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
  'nickname-taken-by-participant': {
    title: 'Pseudo déjà pris',
    detail: ({ nickname }) =>
      `Le participant « ${nickname} » porte déjà ce pseudo : choisis-en un autre.`,
    field: 'nickname',
  },
  'game-master-has-scenarios': {
    title: 'MJ avec des scénarios',
    detail: ({ scenarios }) =>
      scenarios > 1
        ? fr`Ce MJ a ${scenarios} scénarios : supprime-les d'abord.`
        : fr`Ce MJ a un scénario : supprime-le d'abord.`,
  },
  'game-master-unavailable': {
    title: 'MJ indisponible',
    detail: ({ nickname, rank }) =>
      fr`${nickname} n'est pas disponible sur le créneau ${rank} : coche d'abord sa disponibilité sur sa fiche.`,
  },
  'game-master-busy': {
    title: 'MJ déjà occupé',
    detail: ({ nickname, rank }) =>
      fr`${nickname} mène déjà une partie sur le créneau ${rank} : choisis un autre créneau.`,
  },
  'availability-has-game': {
    title: 'Disponibilité programmée',
    detail: ({ nickname, rank }) =>
      fr`${nickname} mène une partie sur le créneau ${rank} : déprogramme-la d'abord.`,
  },
  'game-master-without-availability': {
    title: 'MJ sans disponibilité',
    detail: ({ nickname }) =>
      `${nickname} n'a aucune disponibilité : coche ses créneaux sur sa fiche.`,
  },
  'game-master-busy-everywhere': {
    title: 'MJ occupé partout',
    detail: ({ nickname }) =>
      `${nickname} mène déjà une partie sur chacune de ses disponibilités : coche-lui un autre créneau sur sa fiche, ou déprogramme une partie.`,
  },
  'game-master-without-consecutive-availabilities': {
    title: 'MJ sans créneaux consécutifs',
    detail: ({ nickname }) =>
      fr`${nickname} n'est disponible sur aucun créneau suivi d'un autre : un scénario double en demande deux consécutifs. Coche-les sur sa fiche.`,
  },
  'table-taken': {
    title: 'Table prise',
    detail: ({ table, rank }) =>
      fr`La table « ${table} » accueille déjà une partie sur le créneau ${rank} : choisis une autre table.`,
  },
  'no-free-table': {
    title: 'Aucune table libre',
    detail: ({ rank, twoSlot }) =>
      twoSlot
        ? fr`Toutes les tables sont prises sur le créneau ${rank} ou sur le suivant.`
        : fr`Toutes les tables sont prises sur le créneau ${rank}.`,
  },
  'no-next-time-slot': {
    title: 'Pas de créneau suivant',
    detail: ({ rank }) =>
      fr`Le créneau ${rank} est le dernier de la journée : une partie double commence au plus tard sur le créneau ${rank - 1}.`,
  },
  'time-slot-splits-two-slot-game': {
    title: 'Partie double coupée',
    detail: ({ rank }) =>
      fr`Ce créneau tomberait entre les créneaux ${rank} et ${rank + 1}, qu'occupe une partie double : choisis d'autres heures.`,
    field: 'start',
  },
  'game-already-cancelled': {
    title: 'Partie déjà annulée',
    detail: () => fr`Cette partie est déjà annulée.`,
  },
  'game-not-below-minimum': {
    title: 'Partie au minimum',
    detail: ({ players, min }) =>
      fr`Cette partie a ${countOf(players, 'joueur', 'joueurs')} pour ${countOf(min, 'place', 'places')} au moins : elle ne s'annule pas.`,
  },
  'game-not-cancelled': {
    title: 'Partie maintenue',
    detail: () => fr`Cette partie n'est pas annulée.`,
  },
  'game-not-found': {
    title: 'Partie introuvable',
    detail: () => fr`Cette partie n'existe plus : recharge la page.`,
    status: 404,
  },
  'sign-ups-closed': {
    title: 'Inscriptions fermées',
    detail: ({ rank }) =>
      fr`Le tirage du créneau ${rank} est lancé : ses inscriptions sont fermées.`,
  },
  'time-slot-published': {
    title: 'Créneau publié',
    detail: ({ rank }) =>
      fr`Le tirage du créneau ${rank} est publié : son programme ne change plus.`,
  },
  'time-slot-before-draw': {
    title: 'Tirage lancé après',
    detail: ({ rank, published }) =>
      published
        ? fr`Le tirage du créneau ${rank} est publié : aucun créneau ne se place plus avant lui.`
        : fr`Le tirage du créneau ${rank} est lancé : rouvre d'abord ses inscriptions pour placer un créneau avant lui.`,
  },
  'time-slot-locked-by-draw': {
    title: 'Créneau tiré',
    detail: ({ rank, published }) =>
      published
        ? fr`Le tirage du créneau ${rank} est publié : le créneau ne change plus.`
        : fr`Le tirage du créneau ${rank} est lancé : rouvre d'abord ses inscriptions.`,
  },
  'draw-already-launched': {
    title: 'Tirage déjà lancé',
    detail: ({ rank }) => fr`Le tirage du créneau ${rank} est déjà lancé.`,
  },
  'draw-published': {
    title: 'Tirage publié',
    detail: ({ rank }) =>
      fr`Le tirage du créneau ${rank} est publié : son résultat ne change plus.`,
  },
  'draw-not-launched': {
    title: 'Tirage pas lancé',
    detail: ({ rank }) => fr`Le tirage du créneau ${rank} n'est pas lancé.`,
  },
  'draw-not-published': {
    title: 'Tirage pas publié',
    detail: ({ rank }) =>
      fr`Le tirage du créneau ${rank} n'est pas publié : on n'y ajoute pas de retardataire.`,
  },
  'time-slot-ended': {
    title: 'Créneau terminé',
    detail: ({ rank }) => fr`Le créneau ${rank} est terminé.`,
  },
  'latecomer-already-in-draw': {
    title: 'Déjà dans le tirage',
    detail: ({ nickname, rank }) => fr`${nickname} est déjà dans le tirage du créneau ${rank}.`,
  },
  'latecomer-leads-on-time-slot': {
    title: 'MJ sur ce créneau',
    detail: ({ nickname, rank }) => fr`${nickname} mène une partie sur le créneau ${rank}.`,
  },
  'latecomer-plays-two-slot-game': {
    title: 'Partie double en cours',
    detail: ({ nickname, rank }) =>
      fr`${nickname} joue sur le créneau ${rank} la partie double où le tirage du créneau précédent l'a placé.`,
  },
  'previous-draw-not-published': {
    title: 'Tirage précédent à publier',
    detail: ({ rank, previousRank }) =>
      fr`Le tirage du créneau ${rank} se lance après la publication du créneau ${previousRank}.`,
  },
  'game-cancelled': {
    title: 'Partie annulée',
    detail: () => fr`Cette partie est annulée : rétablis-la d'abord.`,
  },
  'games-without-players': {
    title: 'Partie sans joueur',
    detail: ({ rank, games }) =>
      games > 1
        ? fr`${countOf(games, 'partie', 'parties')} du créneau ${rank} n'ont aucun joueur : annule-les pour publier le tirage.`
        : fr`${countOf(games, 'partie', 'parties')} du créneau ${rank} n'a aucun joueur : annule-la pour publier le tirage.`,
  },
  'game-not-on-time-slot': {
    title: "Partie d'un autre créneau",
    detail: ({ rank }) => fr`Cette partie ne commence pas sur le créneau ${rank}.`,
  },
  'participant-not-in-draw': {
    title: 'Hors du tirage',
    detail: ({ nickname, rank }) =>
      fr`${nickname} ne fait pas partie du tirage du créneau ${rank}.`,
  },
  'game-led-by-participant': {
    title: 'Tu mènes cette partie',
    detail: () => fr`Tu mènes cette partie : tu ne peux pas t'y inscrire.`,
  },
  'game-swapped-with-itself': {
    title: 'Même partie',
    detail: () => fr`Une partie ne s'échange pas avec elle-même : choisis une autre partie.`,
  },
  'scenario-not-found': {
    title: 'Scénario introuvable',
    detail: () => "Ce scénario n'existe plus : recharge la page.",
    status: 404,
  },
  'scenario-duration-locked': {
    title: 'Durée figée',
    detail: () =>
      fr`Ce scénario est programmé : sa durée ne change plus. Déprogramme d'abord ses parties.`,
    field: 'duration',
  },
  'scenario-has-games': {
    title: 'Scénario programmé',
    detail: () => fr`Ce scénario est programmé : déprogramme d'abord ses parties.`,
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
      fr`La présentation fait ${formatCount(max)} caractères au plus : raccourcis-la.`,
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
  'password-too-short': {
    title: 'Mot de passe trop court',
    detail: ({ min }) =>
      fr`Le mot de passe fait au moins ${countOf(min, 'caractère', 'caractères')} : une courte phrase convient.`,
    field: 'password',
  },
  'password-too-long': {
    title: 'Mot de passe trop long',
    detail: ({ max }) =>
      fr`Le mot de passe fait ${countOf(max, 'caractère', 'caractères')} au plus : raccourcis-le.`,
    field: 'password',
  },
  'password-is-nickname': {
    title: 'Mot de passe refusé',
    detail: () => fr`Le mot de passe ne peut pas être ton pseudo : choisis une courte phrase.`,
    field: 'password',
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
  'too-many-attempts': {
    title: "Trop d'essais",
    detail: () => "Tu as fait trop d'essais : réessaie dans quelques minutes.",
    field: 'presenceCode',
    status: 429,
  },
  'too-many-login-attempts': {
    title: "Trop d'essais",
    detail: () => fr`Tu as fait trop d'essais de connexion : réessaie dans une minute.`,
    status: 429,
  },
  'wrong-credentials': {
    title: 'Pseudo ou mot de passe incorrect',
    detail: () =>
      fr`Vérifie ton pseudo et ton mot de passe. En cas d'oubli, demande un lien d'accès à un Organisateur.`,
    status: 401,
  },
  'current-password-wrong': {
    title: 'Mot de passe actuel incorrect',
    detail: () =>
      fr`Vérifie ton mot de passe actuel. En cas d'oubli, demande un lien d'accès à un Organisateur.`,
    field: 'currentPassword',
  },
  'not-logged-in': {
    title: 'Non connecté',
    detail: () => fr`Ta session a pris fin : connecte-toi pour continuer.`,
    status: 401,
  },
  'phone-not-linked': {
    title: 'Téléphone relié à aucun pseudo',
    detail: () => 'Tape ton pseudo pour continuer.',
    status: 401,
  },
  'cross-site-request': {
    title: 'Modification refusée',
    detail: () =>
      fr`Cette modification ne vient pas de l'application : recharge la page, puis recommence.`,
    status: 403,
  },
  'push-not-configured': {
    title: 'Notifications non prises en charge',
    detail: () =>
      fr`Ce serveur n'envoie pas de notifications : reviens voir ta table ici après chaque tirage.`,
    status: 404,
  },
  'internal-error': {
    title: 'Erreur interne',
  },
};

/** Le motif et la phrase d'un refus du domaine, tels que les Problem Details les donnent. */
export function buildRefusalMessage<C extends RefusalCode>(
  code: C,
  params: RefusalParams[C],
): { title: string; detail: string } {
  const message = problemCatalogue[code] as Message<RefusalParams[C]>;
  return { title: message.title, detail: message.detail(params) };
}

/** Un refus du domaine rendu comme verdict d'une lecture, avec son motif et sa phrase. */
export function buildVerdictRefusal({ code, params }: Refusal): VerdictRefusalDto {
  return { code, ...buildRefusalMessage(code, params) };
}
