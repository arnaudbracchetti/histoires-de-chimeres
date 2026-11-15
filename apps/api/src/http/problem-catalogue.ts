import type {
  ProblemCode,
  RefusalCode,
  RefusalParams,
  VerdictRefusalDto,
} from '@chimeres/contract';
import type { Refusal } from '@chimeres/domain';
import { countOf, fr } from '@chimeres/design';

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
    detail: ({ max }) =>
      fr`Le nom de la convention ne doit pas dépasser ${countOf(max, 'caractère', 'caractères')} : raccourcis-le.`,
    field: 'name',
  },
  'convention-ended': {
    title: 'La convention est terminée',
    detail: () =>
      fr`Le dernier créneau est terminé : l'application ne sert plus pour cette convention.`,
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
    detail: () => fr`La fin du créneau doit venir après son début : change l'une des deux heures.`,
    field: 'end',
  },
  'time-slot-start-overlaps': {
    title: 'Créneaux qui se chevauchent',
    detail: ({ rank }) => `Le début tombe pendant le créneau ${rank} : choisis une autre heure.`,
    field: 'start',
  },
  'time-slot-end-overlaps': {
    title: 'Créneaux qui se chevauchent',
    detail: ({ rank }) => fr`Ce créneau empiète sur le créneau ${rank} : termine-le plus tôt.`,
    field: 'end',
  },
  'time-slot-hours-locked': {
    title: 'Heures figées',
    detail: ({ rank, availabilities }) =>
      availabilities > 1
        ? fr`Les heures du créneau ${rank} ne peuvent plus changer : ${countOf(availabilities, 'MJ', 'MJ')} y ont coché leur disponibilité. Pour les changer, supprime le créneau, puis recrée-le : les MJ devront recocher leur disponibilité.`
        : fr`Les heures du créneau ${rank} ne peuvent plus changer : un MJ y a coché sa disponibilité. Pour les changer, supprime le créneau, puis recrée-le : le MJ devra recocher sa disponibilité.`,
  },
  'time-slot-hours-locked-by-games': {
    title: 'Heures figées',
    detail: ({ rank, games }) =>
      games > 1
        ? fr`Le créneau ${rank} a ${countOf(games, 'partie', 'parties')} programmées : ses heures ne peuvent plus changer. Pour les changer, déprogramme-les, supprime le créneau, puis recrée-le.`
        : fr`Le créneau ${rank} a une partie programmée : ses heures ne peuvent plus changer. Pour les changer, déprogramme-la, supprime le créneau, puis recrée-le.`,
  },
  'time-slot-has-games': {
    title: 'Créneau avec des parties',
    detail: ({ rank, games }) =>
      games > 1
        ? fr`Le créneau ${rank} a ${countOf(games, 'partie', 'parties')} programmées : déprogramme-les d'abord pour supprimer ce créneau.`
        : fr`Le créneau ${rank} a une partie programmée : déprogramme-la d'abord pour supprimer ce créneau.`,
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
    detail: ({ max }) =>
      fr`Le nom d'une table ne doit pas dépasser ${countOf(max, 'caractère', 'caractères')} : raccourcis-le.`,
    field: 'name',
  },
  'table-name-taken': {
    title: 'Nom déjà pris',
    detail: ({ name }) => fr`Une autre table s'appelle déjà « ${name} » : choisis un autre nom.`,
    field: 'name',
  },
  'table-has-games': {
    title: 'Table avec des parties',
    detail: ({ name, games }) =>
      games > 1
        ? fr`La table « ${name} » a ${countOf(games, 'partie', 'parties')} programmées : déprogramme-les d'abord pour supprimer cette table.`
        : fr`La table « ${name} » a une partie programmée : déprogramme-la d'abord pour supprimer cette table.`,
  },
  'game-master-not-found': {
    title: 'MJ introuvable',
    detail: () => "Ce MJ n'existe plus : recharge la page.",
    status: 404,
  },
  'participant-not-found': {
    title: 'Pseudo introuvable',
    detail: () => fr`Ce pseudo n'existe plus : recharge la page.`,
    status: 404,
  },
  'participant-is-game-master': {
    title: 'Pseudo de MJ',
    detail: ({ nickname }) =>
      fr`${nickname} est MJ : son pseudo se gère depuis sa fiche de MJ, dans « MJ ».`,
  },
  'merge-into-itself': {
    title: 'Même pseudo',
    detail: () => fr`Un pseudo ne se fusionne pas avec lui-même : choisis un autre pseudo.`,
  },
  'nickname-required': {
    title: 'Pseudo obligatoire',
    detail: () => 'Tape un pseudo.',
    field: 'nickname',
  },
  'nickname-too-long': {
    title: 'Pseudo trop long',
    detail: ({ max }) =>
      fr`Un pseudo ne doit pas dépasser ${countOf(max, 'caractère', 'caractères')} : raccourcis-le.`,
    field: 'nickname',
  },
  'nickname-taken': {
    title: 'Pseudo déjà pris',
    detail: ({ nickname }) => fr`« ${nickname} » est déjà le pseudo d'un MJ : choisis-en un autre.`,
    field: 'nickname',
  },
  'nickname-taken-by-participant': {
    title: 'Pseudo déjà pris',
    detail: ({ nickname }) =>
      fr`« ${nickname} » est déjà le pseudo d'un autre participant : choisis-en un autre.`,
    field: 'nickname',
  },
  'game-master-has-scenarios': {
    title: 'MJ avec des scénarios',
    detail: ({ scenarios }) =>
      scenarios > 1
        ? fr`Ce MJ a ${countOf(scenarios, 'scénario', 'scénarios')} : supprime-les d'abord pour supprimer ce MJ ou lui retirer son rôle.`
        : fr`Ce MJ a un scénario : supprime-le d'abord pour supprimer ce MJ ou lui retirer son rôle.`,
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
    title: 'Disponibilité utilisée',
    detail: ({ nickname, rank }) =>
      fr`${nickname} mène une partie sur le créneau ${rank} : cette disponibilité ne peut pas être retirée tant qu'un Organisateur n'a pas déprogrammé la partie.`,
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
      fr`${nickname} n'a pas de disponibilités sur deux créneaux qui se suivent : incompatible avec un scénario double. Il faut modifier les disponibilités de ce MJ.`,
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
        ? fr`Toutes les tables sont prises sur le créneau ${rank} ou sur le suivant : ajoute une table, ou choisis un autre créneau.`
        : fr`Toutes les tables sont prises sur le créneau ${rank} : ajoute une table, ou choisis un autre créneau.`,
  },
  'no-next-time-slot': {
    title: 'Pas de créneau suivant',
    detail: ({ rank }) =>
      rank > 1
        ? fr`Le créneau ${rank} est le dernier de la journée : une partie double commence au plus tard sur le créneau ${rank - 1}.`
        : fr`Il n'y a qu'un créneau dans la journée : une partie double en demande deux qui se suivent.`,
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
    title: 'Minimum atteint',
    detail: ({ players, min }) =>
      fr`Cette partie a ${countOf(players, 'joueur', 'joueurs')} pour un minimum de ${min} : seule une partie sous son minimum peut être annulée.`,
  },
  'game-not-cancelled': {
    title: 'Partie maintenue',
    detail: () => fr`Cette partie n'est pas annulée : il n'y a rien à rétablir.`,
  },
  'game-not-found': {
    title: 'Partie introuvable',
    detail: () => fr`Cette partie n'existe plus : recharge la page.`,
    status: 404,
  },
  'sign-ups-closed': {
    title: 'Inscriptions fermées',
    detail: ({ rank }) =>
      fr`Les inscriptions du créneau ${rank} sont fermées : les tables sont en cours de répartition. Tu verras ta table dès qu'elle sera publiée.`,
  },
  'time-slot-published': {
    title: 'Créneau publié',
    detail: ({ rank }) =>
      fr`Le tirage du créneau ${rank} est publié : on ne peut plus y programmer, déplacer ni déprogrammer de partie.`,
  },
  'time-slot-before-draw': {
    title: 'Placer un créneau',
    detail: ({ rank, published }) =>
      published
        ? fr`Le tirage du créneau ${rank} est publié : on ne peut plus ajouter ni placer de créneau avant lui.`
        : fr`Le tirage du créneau ${rank} est lancé : rouvre d'abord ses inscriptions pour ajouter ou placer un créneau avant lui.`,
  },
  'time-slot-locked-by-draw': {
    title: 'Créneau bloqué par son tirage',
    detail: ({ rank, published }) =>
      published
        ? fr`Le tirage du créneau ${rank} est publié : ce créneau ne peut plus être modifié ni supprimé.`
        : fr`Le tirage du créneau ${rank} est lancé : ce créneau ne peut plus être modifié ni supprimé. Pour le modifier, rouvre d'abord ses inscriptions : le résultat provisoire sera effacé.`,
  },
  'draw-already-launched': {
    title: 'Tirage déjà lancé',
    detail: ({ rank }) =>
      fr`Le tirage du créneau ${rank} est déjà lancé : pour le refaire, utilise « Relancer le tirage ».`,
  },
  'draw-published': {
    title: 'Tirage publié',
    detail: ({ rank }) =>
      fr`Le tirage du créneau ${rank} est publié : son résultat ne peut plus changer.`,
  },
  'draw-not-launched': {
    title: 'Tirage pas encore lancé',
    detail: ({ rank }) =>
      fr`Le tirage du créneau ${rank} n'est pas encore lancé : lance-le d'abord.`,
  },
  'draw-not-published': {
    title: 'Tirage pas encore publié',
    detail: ({ rank, launched }) =>
      launched
        ? fr`Le tirage du créneau ${rank} est lancé : rouvre ses inscriptions, inscris ce participant aux parties de son choix dans l'onglet Inscriptions de sa fiche, puis lance de nouveau le tirage.`
        : fr`Les inscriptions du créneau ${rank} sont encore ouvertes : inscris ce participant aux parties de son choix, dans l'onglet Inscriptions de sa fiche.`,
  },
  'time-slot-ended': {
    title: 'Créneau terminé',
    detail: ({ rank }) =>
      fr`Le créneau ${rank} est terminé : on ne peut plus y ajouter de retardataire.`,
  },
  'latecomer-already-in-draw': {
    title: 'Déjà dans le tirage',
    detail: ({ nickname, rank }) => fr`${nickname} est déjà dans le tirage du créneau ${rank}.`,
  },
  'latecomer-leads-on-time-slot': {
    title: 'MJ sur ce créneau',
    detail: ({ nickname, rank }) =>
      fr`${nickname} mène une partie sur le créneau ${rank} : on ne peut pas l'y ajouter comme joueur.`,
  },
  'latecomer-plays-two-slot-game': {
    title: 'Partie double en cours',
    detail: ({ nickname, rank }) =>
      fr`${nickname} joue déjà sur le créneau ${rank} : c'est la suite de sa partie double, commencée au créneau précédent.`,
  },
  'previous-draw-not-published': {
    title: 'Tirage précédent à publier',
    detail: ({ previousRank }) =>
      fr`Publie d'abord le tirage du créneau ${previousRank} : les tirages se font dans l'ordre des créneaux.`,
  },
  'game-cancelled': {
    title: 'Partie annulée',
    detail: () => fr`Cette partie est annulée : rétablis-la d'abord.`,
  },
  'games-without-players': {
    title: 'Partie sans joueur',
    detail: ({ rank, games }) =>
      games > 1
        ? fr`${countOf(games, 'partie', 'parties')} du créneau ${rank} n'ont aucun joueur : annule-les, ou déplaces-y des joueurs, pour publier le tirage.`
        : fr`${countOf(games, 'partie', 'parties')} du créneau ${rank} n'a aucun joueur : annule-la, ou déplaces-y des joueurs, pour publier le tirage.`,
  },
  'game-not-on-time-slot': {
    title: "Partie d'un autre créneau",
    detail: ({ rank }) =>
      fr`Cette partie ne commence pas sur le créneau ${rank} : recharge la page.`,
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
      fr`Ce scénario a des parties programmées : sa durée ne peut plus changer. Pour la changer, demande à un Organisateur de déprogrammer ses parties.`,
    field: 'duration',
  },
  'scenario-has-games': {
    title: 'Scénario avec des parties',
    detail: () =>
      fr`Ce scénario a des parties programmées : pour le supprimer, demande à un Organisateur de déprogrammer ses parties.`,
  },
  'scenario-title-required': {
    title: 'Titre obligatoire',
    detail: () => 'Donne un titre au scénario.',
    field: 'title',
  },
  'scenario-title-too-long': {
    title: 'Titre trop long',
    detail: ({ max }) =>
      fr`Le titre ne doit pas dépasser ${countOf(max, 'caractère', 'caractères')} : raccourcis-le.`,
    field: 'title',
  },
  'system-required': {
    title: 'Jeu obligatoire',
    detail: () => fr`Indique le jeu de rôle utilisé pour ce scénario : ses règles et son univers.`,
    field: 'system',
  },
  'system-too-long': {
    title: 'Jeu trop long',
    detail: ({ max }) =>
      fr`Le nom du jeu ne doit pas dépasser ${countOf(max, 'caractère', 'caractères')} : raccourcis-le.`,
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
      fr`La présentation ne doit pas dépasser ${countOf(max, 'caractère', 'caractères')} : raccourcis-la.`,
    field: 'presentation',
  },
  'content-warnings-too-long': {
    title: 'Avertissements trop longs',
    detail: ({ max }) =>
      fr`Les avertissements de contenu ne doivent pas dépasser ${countOf(max, 'caractère', 'caractères')} : raccourcis-les.`,
    field: 'contentWarnings',
  },
  'seats-min-below-one': {
    title: 'Minimum trop bas',
    detail: () => 'Une partie accueille au moins un joueur : mets 1 place minimum ou plus.',
    field: 'seats.min',
  },
  'seats-out-of-order': {
    title: 'Maximum sous le minimum',
    detail: () => 'Le maximum est sous le minimum : augmente-le, ou baisse le minimum.',
    field: 'seats.max',
  },
  'password-too-short': {
    title: 'Mot de passe trop court',
    detail: ({ min }) =>
      fr`Le mot de passe doit faire au moins ${countOf(min, 'caractère', 'caractères')} : une courte phrase convient.`,
    field: 'password',
  },
  'password-too-long': {
    title: 'Mot de passe trop long',
    detail: ({ max }) =>
      fr`Le mot de passe ne doit pas dépasser ${countOf(max, 'caractère', 'caractères')} : raccourcis-le.`,
    field: 'password',
  },
  'password-is-nickname': {
    title: 'Mot de passe refusé',
    detail: () => fr`Le mot de passe ne peut pas être ton pseudo : choisis une courte phrase.`,
    field: 'password',
  },
  'own-organizer-role-withdrawal': {
    title: 'Rôle gardé',
    detail: () =>
      fr`Tu ne peux pas te retirer toi-même le rôle d'Organisateur : un autre Organisateur peut le faire.`,
  },
  'own-nickname-removal': {
    title: 'Pseudo gardé',
    detail: () =>
      fr`Tu ne peux pas supprimer ton propre pseudo : un autre Organisateur peut le faire.`,
  },
  'merge-source-has-account': {
    title: 'Pseudo avec un compte',
    detail: ({ nickname }) =>
      fr`${nickname} a un compte : retire-lui d'abord ses rôles, dans l'onglet « Compte », avant de le fusionner.`,
  },
  'access-link-unknown': {
    title: "Lien d'accès inconnu",
    detail: () =>
      fr`Ce lien d'accès ne marche pas : il est incomplet, ou un plus récent l'a remplacé. Demande un nouveau lien à un Organisateur.`,
    status: 404,
  },
  'access-link-used': {
    title: "Lien d'accès déjà utilisé",
    detail: () =>
      fr`Ce lien d'accès a déjà servi à choisir un mot de passe. Connecte-toi, ou demande un nouveau lien à un Organisateur.`,
    status: 410,
  },
  'access-link-expired': {
    title: "Lien d'accès expiré",
    detail: () =>
      fr`Ce lien d'accès a dépassé ses 7 jours. Demande un nouveau lien à un Organisateur.`,
    status: 410,
  },
  'account-not-found': {
    title: 'Pas de compte',
    detail: () =>
      fr`Ce pseudo n'a pas de compte du back office : donne-lui un rôle pour lui en créer un.`,
    status: 404,
  },
  'malformed-request': {
    title: 'Demande incomprise',
    detail: () => fr`L'application n'a pas compris ta demande : recharge la page, puis recommence.`,
  },
  'concurrent-modification': {
    title: 'Modification simultanée',
    detail: () =>
      fr`Quelqu'un d'autre a modifié la convention en même temps : recharge la page, puis recommence.`,
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
      fr`L'image est abîmée, ou trop grande (plus de 40 mégapixels) : enregistre-la de nouveau en JPEG, plus petite, puis recommence.`,
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
    detail: () => fr`Ta connexion a expiré : reconnecte-toi pour continuer.`,
    status: 401,
  },
  'access-denied': {
    title: 'Accès refusé',
    detail: () => fr`Ton compte ne donne pas accès à cette page.`,
    status: 403,
  },
  'phone-not-linked': {
    title: 'Pseudo à indiquer',
    detail: () => fr`Ce téléphone n'est relié à aucun pseudo : tape ton pseudo pour continuer.`,
    status: 401,
  },
  'cross-site-request': {
    title: 'Modification refusée',
    detail: () =>
      fr`Cette modification ne vient pas de l'application : recharge la page, puis recommence.`,
    status: 403,
  },
  'public-url-missing': {
    title: 'Adresse du site manquante',
    detail: () =>
      fr`Le serveur ne connaît pas son adresse publique : le lien d'accès ne peut pas se construire. Préviens la personne qui gère le serveur, pour qu'elle ajoute PUBLIC_URL à sa configuration.`,
    status: 503,
  },
  'push-not-configured': {
    title: 'Notifications non prises en charge',
    detail: () =>
      fr`Ce serveur n'envoie pas de notifications : reviens ici avant chaque créneau pour voir ta table.`,
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
