// PROTOTYPE (#59). Protocoles déroulés depuis le pilotage : chaque étape dit quoi faire sur le
// téléphone, quoi noter, et quelles lignes du journal la concernent. Les résultats sont rangés par
// le serveur, par protocole et par étape.

export interface Step {
  id: string;
  title: string;
  // Gestes, dans l'ordre (sur le téléphone, sauf mention du pilotage).
  actions: string[];
  // La question à laquelle répond le résultat (oui, non, partiel).
  question: string;
  // Ce qu'il faut écrire dans la note.
  observe: string[];
  // Lignes du journal montrées sous l'étape.
  journal?: RegExp;
}

export interface Part {
  title: string;
  intro?: string;
  steps: Step[];
}

export interface Protocol {
  id: string;
  title: string;
  issue: { number: number; title: string };
  purpose: string;
  setup: string[];
  devicePlaceholder: string;
  parts: Part[];
}

const OPENING = /Ouverture|Passer dans|display-mode/;

const ANDROID_INSTALL: Protocol = {
  id: 'android-installation',
  title: 'Android : installer depuis la page et passer dans l’application',
  issue: { number: 61, title: 'Tester sur Android : installer depuis la page et passer dans l’application' },
  purpose:
    'Savoir si, sur Android, l’écran « Installe l’application » peut garder son bouton « Installer », et si l’écran ' +
    '« L’application est installée » peut garder son bouton « Ouvrir l’application » (parcours d’accueil, variante B). ' +
    'Sinon, ne restent que l’icône et le menu ⋮ de Chrome : il faut alors leurs libellés exacts.',
  setup: [
    'Le Samsung S22, en 4G. Chrome est le navigateur par défaut (sinon le QR code ouvre Samsung Internet).',
    'Ce pilotage ouvert sur l’ordinateur. Chaque geste du téléphone remonte au journal, et les lignes utiles s’affichent sous chaque étape.',
    'Relever les versions : Réglages → À propos du téléphone → Informations sur le logiciel (Android, One UI), et Chrome → ⋮ → Paramètres → À propos de Chrome. Les écrire dans « Appareil », puis « Commencer une série ».',
    'Faire une capture d’écran chaque fois qu’un libellé de Chrome est à noter : elle ira dans le commentaire de résolution.',
    'Environ 1 s après chaque scan du QR code, Google (Google-Read-Aloud) ouvre la même page : ses lignes viennent d’un téléphone « sans nom ». Les ignorer.',
  ],
  devicePlaceholder: 'Samsung S22, Android 16, One UI 8, Chrome 155',
  parts: [
    {
      title: 'Préparation',
      steps: [
        {
          id: 'nettoyage',
          title: 'Partir d’un téléphone sans le labo',
          actions: [
            'Écran d’accueil : appui long sur l’icône « Labo » → Désinstaller. Même chose pour « Labo B », s’il existe.',
            'Chrome → ⋮ → Paramètres → Paramètres des sites → Tous les sites → test.nekbet.fr : effacer ses données et réinitialiser ses autorisations.',
            'Fermer tous les onglets de test.nekbet.fr.',
          ],
          question: 'Plus d’icône Labo, et le site effacé ?',
          observe: ['Ce qui a résisté (icône restée, site absent de la liste…).'],
        },
      ],
    },
    {
      title: 'Le bouton « Installer »',
      steps: [
        {
          id: 'bip-premier',
          title: 'Ouvrir la page : Chrome envoie-t-il beforeinstallprompt ?',
          actions: [
            'Scanner le QR A du pilotage (« Manifeste avec start_url ») avec l’appareil photo, et ouvrir le lien.',
            'Nommer le téléphone « S22 » (section « Ce téléphone »).',
            'Ne plus rien toucher, et regarder la section « Installation » pendant 1 min.',
            'Si rien n’arrive : toucher la page, la faire défiler, attendre 1 min, puis recharger (tirer vers le bas).',
          ],
          question: 'beforeinstallprompt reçu ?',
          observe: [
            'Délai après l’ouverture (ligne « beforeinstallprompt » de la section).',
            'Le geste qui l’a déclenché, s’il a fallu toucher ou recharger.',
            'Chrome montre-t-il de lui-même une barre ou une invite d’installation ? (La page la bloque : elle ne devrait pas paraître.)',
          ],
          journal: /beforeinstallprompt|Ouverture/,
        },
        {
          id: 'menu-avant',
          title: 'Menu ⋮ de Chrome, avant l’installation',
          actions: ['Sur la page du labo, ouvrir le menu ⋮ de Chrome, et faire une capture d’écran.', 'Fermer le menu sans rien choisir.'],
          question: 'Une entrée d’installation est-elle dans le menu ?',
          observe: ['Son libellé exact (« Installer l’application », « Ajouter à l’écran d’accueil »…) et sa place dans le menu.'],
        },
        {
          id: 'annuler',
          title: '« Installer », puis « Annuler »',
          actions: [
            'Section « Installation » : toucher « Installer ».',
            'Dans la fenêtre de Chrome, faire une capture d’écran, puis toucher « Annuler ».',
            'Rester sur la page 2 min, sans recharger.',
          ],
          question: 'Le bouton ouvre-t-il la fenêtre d’installation de Chrome ?',
          observe: [
            'Contenu de la fenêtre : titre, nom et icône de l’application, boutons.',
            'Réponse lue par la page (journal : « Installer : dismissed »).',
            'Chrome renvoie-t-il beforeinstallprompt sans rechargement ? Le bouton revient-il ?',
          ],
          journal: /Installer|beforeinstallprompt/,
        },
        {
          id: 'apres-annuler',
          title: 'Après « Annuler » : quand Chrome renvoie-t-il beforeinstallprompt ?',
          actions: [
            'Recharger la page (tirer vers le bas). Attendre 1 min.',
            'S’il ne revient pas : fermer l’onglet, rescanner le QR A, attendre 1 min.',
            'S’il ne revient toujours pas : installer par le menu ⋮ (2e geste de l’étape 14) au lieu de l’étape 6, puis reprendre à l’étape 7.',
          ],
          question: 'beforeinstallprompt renvoyé ?',
          observe: ['Après quel geste (rechargement, nouvel onglet), et avec quel délai.'],
          journal: /beforeinstallprompt|Ouverture/,
        },
        {
          id: 'installer',
          title: '« Installer », puis « Installer »',
          actions: [
            'Toucher « Installer » dans la section, puis « Installer » dans la fenêtre de Chrome.',
            'Ne rien toucher ensuite : regarder ce qu’affiche Chrome, et faire une capture d’écran.',
            'Vérifier, sans quitter Chrome (rideau des notifications), que l’icône « Labo » est arrivée.',
          ],
          question: 'Application installée en deux taps ?',
          observe: [
            'Nombre de taps, et temps jusqu’à l’icône.',
            'Ce qu’affiche Chrome après : message, bouton « Ouvrir », notification. Libellés exacts.',
            'La page reste-t-elle ouverte dans Chrome ?',
          ],
          journal: /Installer|appinstalled/,
        },
        {
          id: 'appinstalled',
          title: 'La page restée dans Chrome reçoit-elle appinstalled ?',
          actions: ['Sur la page restée dans Chrome, lire la ligne « appinstalled » de la section « Installation ».'],
          question: 'appinstalled reçu ?',
          observe: ['Délai entre le tap sur « Installer » et appinstalled (journal).'],
          journal: /appinstalled|Installer : accepted/,
        },
      ],
    },
    {
      title: 'Passer dans l’application depuis Chrome',
      intro:
        'Chaque essai part de l’onglet du labo dans Chrome, l’application installée. Avant chacun : fermer l’application si elle est ouverte ' +
        '(onglets récents, balayer), et revenir à cet onglet. Après : noter où la page s’ouvre. L’application n’a pas de barre d’adresse, ' +
        'et sa section « Ce téléphone » dit « web app » ; un onglet de Chrome dit « navigateur ».',
      steps: [
        {
          id: 'lien',
          title: 'Lien, même onglet',
          actions: ['Section « Passer dans l’application » : toucher « Lien, même onglet ».'],
          question: 'L’application s’ouvre-t-elle ?',
          observe: ['Où la page s’ouvre, et ce que devient l’onglet de Chrome.'],
          journal: OPENING,
        },
        {
          id: 'nouvel-onglet',
          title: 'Lien, nouvel onglet',
          actions: ['Section « Passer dans l’application » : toucher « Lien, nouvel onglet ».'],
          question: 'L’application s’ouvre-t-elle ?',
          observe: ['Où la page s’ouvre, et ce que devient l’onglet de Chrome.'],
          journal: OPENING,
        },
        {
          id: 'intent',
          title: 'Lien intent://',
          actions: ['Section « Passer dans l’application » : toucher « intent:// ».'],
          question: 'L’application s’ouvre-t-elle ?',
          observe: [
            'Où la page s’ouvre. Android demande-t-il avec quelle application ouvrir le lien ?',
            'Une ouverture avec « ouvert-par=intent-repli » veut dire qu’Android n’a trouvé aucune application.',
          ],
          journal: OPENING,
        },
        {
          id: 'menu-apres',
          title: 'Menu ⋮ de Chrome, après l’installation',
          actions: [
            'Dans l’onglet du labo, ouvrir le menu ⋮ de Chrome, et faire une capture d’écran.',
            'Toucher l’entrée qui ouvre l’application, si elle existe.',
          ],
          question: 'Une entrée du menu ouvre-t-elle l’application ?',
          observe: [
            'Son libellé exact (« Ouvrir dans Labo », « Ouvrir l’application »…).',
            'Chrome propose-t-il « Ouvrir » ailleurs : barre d’adresse, bandeau en bas de la page ?',
          ],
          journal: OPENING,
        },
        {
          id: 'applis-liees',
          title: 'La page dans Chrome sait-elle que l’application est installée ?',
          actions: [
            'Revenir à l’onglet du labo dans Chrome. Toucher « Revérifier les applis liées ».',
            'Recharger la page, et relire la ligne « Applis liées ».',
          ],
          question: 'getInstalledRelatedApps voit-il l’application ?',
          observe: [
            'En plus du ticket : la carte de l’Accueil « tant qu’on reste dans Chrome » en a besoin.',
            'Résultat avant et après rechargement.',
            'beforeinstallprompt arrive-t-il encore, l’application installée ?',
          ],
          journal: /getInstalledRelatedApps|beforeinstallprompt/,
        },
      ],
    },
    {
      title: 'display-mode',
      steps: [
        {
          id: 'display-mode',
          title: 'La page sait-elle qu’elle tourne dans l’application ?',
          actions: [
            'Fermer l’application (onglets récents, balayer), puis l’ouvrir par son icône.',
            'Lire la ligne « display-mode » de la section « Installation ».',
            'Revenir à l’onglet du labo dans Chrome, et relire la ligne.',
          ],
          question: 'standalone dans l’application, browser dans Chrome ?',
          observe: ['La valeur dans chaque cas, et dans l’application ouverte depuis Chrome (étapes 8 à 11), si l’une a marché.'],
          journal: OPENING,
        },
      ],
    },
    {
      title: 'Le chemin du menu ⋮ (si le bouton manque)',
      steps: [
        {
          id: 'menu-installer',
          title: 'Installer par le menu ⋮',
          actions: [
            'Désinstaller l’application (appui long sur l’icône → Désinstaller).',
            'Dans Chrome, recharger la page du labo. Menu ⋮ → l’entrée notée à l’étape 3 → confirmer.',
          ],
          question: 'Même application qu’avec le bouton ?',
          observe: [
            'Libellés et nombre de taps.',
            'Vraie application (dans Réglages → Applications) ou simple raccourci (petit logo Chrome sur l’icône) ?',
            'appinstalled reçu par la page ?',
          ],
          journal: /appinstalled|beforeinstallprompt/,
        },
      ],
    },
  ],
};

const COOKIE = /Cookie|Ouverture/;
const SUBSCRIPTION = /Abonnement|Permission|permission/;
const PUSH = /n°|SwPush/;
const BACKGROUND = /Minuterie|Flux SSE|arrière-plan|premier plan|pagehide|pageshow|freeze|resume/;

const IPHONE: Protocol = {
  id: 'iphone',
  title: 'iPhone : stockage, push et arrière-plan',
  issue: { number: 60, title: 'Tester sur un iPhone : stockage, push et arrière-plan' },
  purpose:
    'Confirmer ou corriger le pire cas sur lequel le parcours d’accueil et la fraîcheur des données sont conçus : cookie de Safari ' +
    'absent dans la web app, code de présence absent à la première ouverture, pas de geste de retour, ni minuterie ni connexion en ' +
    'arrière-plan, pas de bannière au premier plan. Relever aussi les libellés de Safari et des Réglages pour les guides.',
  setup: [
    'L’iPhone en 4G, Wi-Fi coupé (Réglages → Wi-Fi), comme sur place.',
    'Ce pilotage ouvert sur l’ordinateur. Chaque geste du téléphone remonte au journal, et les lignes utiles s’affichent sous chaque étape.',
    'Relever le modèle et la version d’iOS (Réglages → Général → Informations). Les écrire dans « Appareil », puis « Commencer une série ».',
    'Safari et la web app de l’écran d’accueil ont chacun leur stockage : ils apparaissent comme deux téléphones dans le pilotage.',
    'Depuis iOS 18.4, un message au format double s’affiche par le format déclaratif, sans passer par le service worker : il n’apparaît pas dans « Vu par le worker ». Le format « onActionClick seul (Angular) », lui, passe par le worker, comme sur un iOS plus ancien.',
    'Faire une capture d’écran chaque fois qu’un libellé de Safari ou des Réglages est à noter : elle ira dans le commentaire de résolution.',
  ],
  devicePlaceholder: 'iPhone 15, iOS 26.0.1',
  parts: [
    {
      title: 'Préparation',
      steps: [
        {
          id: 'nettoyage',
          title: 'Partir d’un iPhone sans le labo',
          actions: [
            'Écran d’accueil : appui long sur l’icône « Labo » → Supprimer l’app. Même chose pour « Labo B », s’il existe.',
            'Réglages → Apps → Safari → Avancé → Données de sites web : supprimer test.nekbet.fr.',
            'Fermer tous les onglets de test.nekbet.fr dans Safari.',
          ],
          question: 'Plus d’icône Labo, et le site effacé ?',
          observe: ['Ce qui a résisté, et le chemin exact des Réglages s’il diffère.'],
        },
      ],
    },
    {
      title: 'Dans Safari, avant l’installation',
      steps: [
        {
          id: 'safari',
          title: 'Ouvrir la page dans Safari : que voit-elle ?',
          actions: [
            'Scanner le QR A du pilotage (« Manifeste avec start_url ») avec l’appareil photo, et ouvrir le lien.',
            'Nommer le téléphone « iPhone Safari » (section « Ce téléphone »).',
            'Lire les sections « Installation » et « Notifications ».',
          ],
          question: 'Safari dit-il qu’il ne peut pas recevoir de notifications ?',
          observe: [
            'display-mode, et les lignes Notification, PushManager, window.pushManager, SwPush.isEnabled.',
            'Ces valeurs servent au bandeau de NO-6 (cas « iPhone hors de l’écran d’accueil ») : lesquelles distinguent Safari de la web app ?',
          ],
          journal: OPENING,
        },
        {
          id: 'cookie-avant',
          title: 'Poser le cookie dans Safari',
          actions: ['Section « Cookie HttpOnly » : « Poser le cookie ». Lire la ligne verte.'],
          question: 'Cookie posé et relu par le serveur ?',
          observe: ['L’heure du cookie : elle servira aux étapes 5 et 6.'],
          journal: COOKIE,
        },
      ],
    },
    {
      title: 'Ajout à l’écran d’accueil',
      steps: [
        {
          id: 'ajout',
          title: 'Ajouter à l’écran d’accueil depuis Safari',
          actions: [
            'Sur la page du labo : ••• → Partager → Sur l’écran d’accueil. Une capture d’écran à chaque écran.',
            'Laisser « Ouvrir en tant qu’app web » activé, s’il existe. Toucher « Ajouter ».',
          ],
          question: 'L’icône « Labo » est-elle sur l’écran d’accueil ?',
          observe: [
            'Libellés exacts et ordre des écrans, et nombre de taps (pour le guide en quatre étapes du parcours d’accueil).',
            'Le nom proposé, et l’icône.',
            'Safari ouvre-t-il l’app de lui-même après l’ajout ?',
          ],
        },
        {
          id: 'premiere-ouverture',
          title: 'Première ouverture de la web app',
          actions: [
            'Ouvrir l’app par son icône. La nommer « iPhone app ».',
            'Lire « Ce téléphone », « Ouverture et code de présence » et « Cookie HttpOnly ».',
          ],
          question: 'La web app reçoit-elle le code du QR à sa 1re ouverture ?',
          observe: [
            'Code lu à la 1re ouverture (manifeste A : start_url sans code).',
            'Identifiant « créé à cette ouverture » : stockage séparé de Safari ?',
            'Cookie reçu ou non. S’il l’est : par qui et à quelle heure (celle de l’étape 3 ?).',
            'display-mode, et les lignes de « Notifications ».',
          ],
          journal: COOKIE,
        },
        {
          id: 'cookie-apres',
          title: 'Un cookie posé après l’installation arrive-t-il dans la web app ?',
          actions: [
            'Revenir dans Safari, sur la page du labo : « Poser le cookie » (nouvelle heure).',
            'Revenir dans la web app : « Relire ».',
          ],
          question: 'La web app voit-elle le nouveau cookie ?',
          observe: [
            'L’heure du cookie lu par la web app : celle d’avant l’installation (copie à l’ajout), la nouvelle (stockage partagé), ou aucun.',
          ],
          journal: COOKIE,
        },
        {
          id: 'lien',
          title: 'Un lien ouvre-t-il la web app ?',
          actions: [
            'S’envoyer par Messages l’adresse https://test.nekbet.fr/?code=LABO42&ouvert-par=message, et la toucher.',
            'Même essai depuis Notes, si Messages ouvre Safari.',
          ],
          question: 'Le lien s’ouvre-t-il dans la web app ?',
          observe: ['Où il s’ouvre (Safari, aperçu dans Messages, web app), et le contexte lu par la page.'],
          journal: OPENING,
        },
      ],
    },
    {
      title: 'Notifications : refus, Réglages, abonnement',
      intro:
        'Tout se passe dans la web app. On refuse d’abord, pour relever le chemin des Réglages (écran « Notifications bloquées ») ' +
        'et voir si l’app peut s’abonner seule après la réactivation.',
      steps: [
        {
          id: 'refus',
          title: 'Premier tap : le dialogue s’affiche-t-il ? Refuser.',
          actions: [
            'Section « Notifications » : cocher « S’abonner seul, sans tap… ».',
            'Toucher « S’abonner (SwPush) ». Faire une capture du dialogue, et toucher « Ne pas autoriser ».',
            'Si aucun dialogue ne s’affiche : essayer « S’abonner (pushManager du worker) », puis « S’abonner (window.pushManager) ».',
          ],
          question: 'Le dialogue d’iOS s’affiche-t-il au tap sur « S’abonner (SwPush) » ?',
          observe: [
            'Le bouton qui l’a fait apparaître : SwPush garde-t-il le geste de l’utilisateur ?',
            'Texte exact du dialogue.',
            'Un 2e tap sur le même bouton : nouveau dialogue, ou refus immédiat (journal) ?',
          ],
          journal: SUBSCRIPTION,
        },
        {
          id: 'reglages',
          title: 'Réactiver dans les Réglages, puis revenir',
          actions: [
            'Sans fermer la web app : Réglages → Notifications → Labo → Autoriser les notifications. Une capture de chaque écran.',
            'Revenir dans la web app (balayer vers le haut, toucher Labo), sans rien toucher.',
            'Si l’abonnement n’est pas parti seul : fermer la web app (balayer vers le haut, la chasser), la rouvrir, attendre 10 s.',
          ],
          question: 'L’app s’abonne-t-elle seule, sans tap, à son retour ?',
          observe: [
            'Chemin exact des Réglages (pour l’écran « Notifications bloquées »). L’app y est-elle aussi dans Réglages → Apps ?',
            'Journal : « Abonnement reçu (sans tap) », ou « Abonnement sans tap refusé » et l’erreur.',
            'Si rien ne part seul : toucher « S’abonner (SwPush) », et noter si cela marche.',
          ],
          journal: SUBSCRIPTION,
        },
        {
          id: 'abonne',
          title: 'Abonnement en place',
          actions: [
            'Section « Notifications » : décocher « S’abonner seul… ». Lire « Abonnement ».',
            'Pilotage : la web app apparaît dans les destinataires de « Envoi ».',
          ],
          question: 'Abonné, avec un endpoint web.push.apple.com ?',
          observe: ['Le chemin qui a abonné l’app (pilotage, ligne « Abonnement » du téléphone).'],
          journal: SUBSCRIPTION,
        },
      ],
    },
    {
      title: 'Push, app fermée',
      intro:
        'Avant chaque envoi : fermer la web app (balayer vers le haut depuis le bas de l’écran, puis chasser l’app vers le haut). ' +
        'Pilotage, section « Envoi » : cocher seulement « iPhone app ».',
      steps: [
        {
          id: 'delai',
          title: 'Délai de livraison avec Urgency: high',
          actions: [
            'Pilotage : modèle « Nouvelle partie », format « onActionClick seul (Angular) », Urgency high, délai 10 s, 3 envois, intervalle 30 s. Envoyer.',
            'Ne pas toucher les notifications.',
          ],
          question: 'Les trois notifications arrivent-elles ?',
          observe: [
            'Délais lus dans « Vu par le worker » du tableau des envois.',
            'Écran allumé ou verrouillé pendant l’essai.',
          ],
          journal: PUSH,
        },
        {
          id: 'tap-double',
          title: 'Tap, format double (le format de la cible)',
          actions: [
            'Effacer les notifications du labo (centre de notifications).',
            'Pilotage : modèle « Partie déplacée », format « Double », délai 10 s, 1 envoi. Envoyer, verrouiller l’iPhone.',
            'Toucher la notification sur l’écran verrouillé.',
          ],
          question: 'Le tap ouvre-t-il la page « Ouvert par une notification » ?',
          observe: [
            'Chemin affiché par la page : navigate (déclaratif, attendu sur iOS 18.4 et plus) ou onActionClick.',
            'Ligne « Chargement » de la page.',
            '« Vu par le worker » vide pour cet envoi ?',
          ],
          journal: PUSH,
        },
        {
          id: 'tap-angular',
          title: 'Tap, format Angular seul (comme un iOS avant 18.4)',
          actions: [
            'Fermer la web app. Pilotage : même modèle, format « onActionClick seul (Angular) », délai 10 s. Envoyer.',
            'Toucher la notification.',
          ],
          question: 'Le tap ouvre-t-il la page « Ouvert par une notification » par onActionClick ?',
          observe: ['Page ouverte, chemin, ligne « Chargement ».'],
          journal: PUSH,
        },
      ],
    },
    {
      title: 'Push, app au premier plan (NO-5)',
      intro: 'La web app ouverte sur l’accueil du labo, écran allumé.',
      steps: [
        {
          id: 'premier-plan-double',
          title: 'Format double, app ouverte',
          actions: ['Pilotage : modèle « Nouvelle partie », format « Double », délai 5 s. Envoyer, et regarder l’iPhone.'],
          question: 'Une bannière s’affiche-t-elle en haut de l’écran ?',
          observe: [
            'Son, vibration, et présence dans le centre de notifications.',
            'La page voit-elle le message ? (journal : « Push reçu page ouverte (SwPush.messages) »)',
            'Si une bannière s’affiche : la toucher, et noter la page et le chemin.',
          ],
          journal: PUSH,
        },
        {
          id: 'premier-plan-angular',
          title: 'Format Angular seul, app ouverte',
          actions: ['Même envoi, format « onActionClick seul (Angular) ».'],
          question: 'Une bannière s’affiche-t-elle en haut de l’écran ?',
          observe: ['Son, centre de notifications, et SwPush.messages (journal).', 'Si une bannière s’affiche : la toucher, et noter la page et le chemin.'],
          journal: PUSH,
        },
      ],
    },
    {
      title: 'Titres (NO-2)',
      steps: [
        {
          id: 'titres',
          title: 'Où le titre se coupe-t-il ?',
          actions: [
            'iPhone verrouillé. Pilotage, format « Double », un envoi de chaque : « Titre le plus long », « Publication, affecté, partie double », « Nouvelle partie, inscriptions rouvertes ».',
            'Capture de l’écran verrouillé, puis du centre de notifications. Appui long sur une notification pour la déplier.',
          ],
          question: 'Les titres s’affichent-ils en entier ?',
          observe: [
            'Pour chaque titre : le texte affiché, et où il se coupe (le pilotage compte les caractères).',
            'Nombre de lignes du corps avant la coupure, replié et déplié.',
          ],
          journal: PUSH,
        },
      ],
    },
    {
      title: 'Remplacement de deux « nouvelle partie »',
      intro: 'App fermée, iPhone verrouillé. Effacer d’abord les notifications du labo.',
      steps: [
        {
          id: 'tag',
          title: 'En ligne : tag',
          actions: ['Pilotage : modèle « Nouvelle partie », format « Double », tag et Topic laissés, 2 envois, intervalle 10 s. Envoyer.'],
          question: 'La 2e remplace-t-elle la 1re, sans nouveau son ?',
          observe: ['Nombre de notifications du labo à la fin, et sons entendus.', 'Les notifications d’autres modèles déjà affichées restent-elles empilées ?'],
          journal: PUSH,
        },
        {
          id: 'topic-worker',
          title: 'Hors ligne : Topic, lu par le worker',
          actions: [
            'Centre de contrôle : mode avion, et vérifier que le Wi-Fi est coupé aussi.',
            'Pilotage : modèle « Nouvelle partie », format « onActionClick seul (Angular) », tag et Topic laissés, 2 envois, intervalle 10 s. Envoyer.',
            'Attendre 30 s après le 2e envoi, puis couper le mode avion.',
          ],
          question: 'Seul le 2e envoi est-il vu par le worker ?',
          observe: [
            '« Vu par le worker » de chaque envoi : une notification remplacée par Topic n’y apparaît jamais.',
            'Nombre de notifications affichées, et sons.',
          ],
          journal: PUSH,
        },
        {
          id: 'topic-double',
          title: 'Hors ligne : Topic, format double, sans tag',
          actions: [
            'Effacer les notifications du labo. Mode avion, Wi-Fi coupé.',
            'Pilotage : modèle « Nouvelle partie », format « Double », vider le champ tag, Topic laissé, 2 envois, intervalle 10 s. Envoyer.',
            'Attendre 30 s après le 2e envoi, puis couper le mode avion.',
          ],
          question: 'Une seule notification s’affiche-t-elle ?',
          observe: ['Sans tag, seule Topic peut remplacer : combien de notifications, lesquelles (« (1/2) » ou « (2/2) » en fin de corps) ?'],
          journal: PUSH,
        },
      ],
    },
    {
      title: 'Retour',
      steps: [
        {
          id: 'retour',
          title: 'Geste du bord gauche dans la web app',
          actions: [
            'Dans la web app : « Empiler des écrans », puis 3 fois « Écran suivant ».',
            'Glisser depuis le bord gauche de l’écran vers la droite.',
          ],
          question: 'Le geste revient-il à l’écran précédent ?',
          observe: ['Ce qui se passe : écran précédent, rien, fermeture de l’app.', 'Lignes « Retour (popstate) » du journal.'],
          journal: /Retour|Écran/,
        },
      ],
    },
    {
      title: 'Arrière-plan',
      steps: [
        {
          id: 'arriere-plan',
          title: 'Écran d’accueil de l’iPhone, 5 min',
          actions: ['Web app sur l’accueil du labo. Revenir à l’écran d’accueil de l’iPhone, attendre 5 min, rouvrir la web app.'],
          question: 'La page reprend-elle seule au retour (flux SSE rouvert, journal remonté) ?',
          observe: [
            'Durée sans tick de la minuterie.',
            'Délai entre le passage en arrière-plan et la coupure du flux SSE (« Flux SSE fermé après… », côté serveur).',
            '« Revient au premier plan » (visibilitychange) arrive-t-il ? « Flux SSE ouvert » après ?',
          ],
          journal: BACKGROUND,
        },
        {
          id: 'verrouille',
          title: 'iPhone verrouillé, 5 min',
          actions: ['Web app sur l’accueil du labo. Verrouiller l’iPhone, attendre 5 min, déverrouiller.'],
          question: 'La page reprend-elle seule au retour ?',
          observe: ['Mêmes points qu’à l’étape précédente.'],
          journal: BACKGROUND,
        },
      ],
    },
    {
      title: 'Hors ligne',
      steps: [
        {
          id: 'hors-ligne',
          title: 'Programme lu sans réseau, app rouverte',
          actions: [
            'Dans la web app, avec du réseau : « Programme hors ligne ». Noter l’heure « Écrit par le serveur ».',
            'Mode avion, Wi-Fi coupé. Fermer la web app (la chasser), la rouvrir, toucher « Programme hors ligne ».',
            'Couper le mode avion.',
          ],
          question: 'L’app démarre-t-elle, et le programme s’affiche-t-il, sans réseau ?',
          observe: [
            'Page de réouverture (accueil, ou dernière page vue).',
            'Heure « Écrit par le serveur » : celle d’avant le mode avion ?',
          ],
          journal: /Programme|Réseau|Ouverture/,
        },
      ],
    },
    {
      title: 'Manifeste B : sans start_url',
      intro: 'À la fin, car supprimer l’app efface son abonnement.',
      steps: [
        {
          id: 'manifeste-b',
          title: 'Le code du QR arrive-t-il dans une app sans start_url ?',
          actions: [
            'Supprimer l’app « Labo » (appui long → Supprimer l’app).',
            'Scanner le QR B du pilotage (« Manifeste B, sans start_url »), et l’ajouter à l’écran d’accueil comme à l’étape 4.',
            'Ouvrir « Labo B » par son icône. La nommer « iPhone app B ».',
          ],
          question: 'Code lu à la 1re ouverture : LABO42 ?',
          observe: ['URL de la 1re ouverture. Cookie reçu ou non.'],
          journal: OPENING,
        },
      ],
    },
  ],
};

export const PROTOCOLS: Protocol[] = [IPHONE, ANDROID_INSTALL];
