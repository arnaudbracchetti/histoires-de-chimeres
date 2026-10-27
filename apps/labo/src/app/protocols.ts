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

export const PROTOCOLS: Protocol[] = [ANDROID_INSTALL];
