# Bibliothèques d'interface pour Angular 22

Recherche menée pour le ticket [#9](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/9), sous-ticket de la carte #1 « Initialiser une convention dans le back office, et charte d'IHM ». La décision revient au ticket #10, en HITL : ce document rassemble des faits, il ne tranche pas.

État au 21 octobre 2026. Versions examinées : Angular 22.2.3, TypeScript 6.0.3, Angular Material et CDK 22.2.3, PrimeNG 22.1.3, Spartan 1.8.0, Tailwind CSS 4.3.3.

## Question

Quelles options d'interface conviennent aux deux applications Angular 22 : le back office, sur ordinateur, et le front office, une PWA consultée en 4G ? Candidats : Angular Material 3, Angular CDK avec du CSS maison, PrimeNG, Spartan, Tailwind CSS (seul ou combiné).

## Méthode

- **Sources primaires uniquement** : registre npm (métadonnées et contenu des paquets publiés), dépôts GitHub (code, CHANGELOG, issues), documentation officielle. Les articles de presse ne servent qu'à retrouver une source primaire.
- **Banc de mesure** construit pour l'occasion, hors du dépôt : un même écran (un bouton, un dialogue modal, un champ texte, une liste déroulante, une case à cocher, un formulaire Signal Forms, un thème sombre aux couleurs de la charte) écrit six fois, une fois par option. Chaque variante est compilée en production par `@angular/build` 22.2.3, en `strictTemplates`. Un test Playwright vérifie ensuite, dans Chromium, que les valeurs saisies atteignent le modèle Signal Forms. Le détail est en [annexe](#annexe--banc-de-mesure).

## Résumé des faits

1. **Compatibilité.** Les cinq candidats acceptent Angular 22 et TypeScript 6.0 d'après leurs peer dependencies. Leur installation commune ne produit aucun avertissement, et le banc compile et fonctionne avec chacun.
2. **PrimeNG n'est plus libre depuis la version 22.** Elle est publiée sous la « PrimeUI License » commerciale, en code compilé seulement. Il faut une clé, à renouveler chaque année pour la licence gratuite Community. Sans clé valide, l'application affiche en production un bandeau « Invalid PrimeUI License » (constaté sur le banc). La dernière version MIT, PrimeNG 21, n'accepte pas Angular 22.
3. **Poids mesuré** (transfert estimé, Brotli, pour l'écran du banc) : environ 54 ko pour Angular seul avec des éléments HTML natifs, puis +2 ko avec Tailwind, +18 ko avec le CDK, +61 ko avec Spartan, +66 ko avec Material, +83 à +96 ko avec PrimeNG.
4. **Signal Forms.** Ils sont stables depuis Angular 22.0. Les six variantes du banc relient leurs contrôles à `[formField]`. Seul Angular Material a une intégration native, qui lit l'état d'erreur. PrimeNG et Spartan passent par `ControlValueAccessor`, une voie qu'Angular présente comme réservée à la compatibilité.
5. **Glisser-déposer.** Le CDK (`@angular/cdk/drag-drop`) est la seule brique dédiée parmi les candidats. Il gère la souris et le tactile, mais pas le clavier : la demande est ouverte depuis 2022. Le motif Grid d'Angular Aria (stable depuis la 22.0) apporte la navigation au clavier dans une grille.
6. **Pérennité.** Angular Material, le CDK et Angular Aria suivent le calendrier d'Angular. Spartan n'a que quatre mois en version 1.x, et son propre dépôt est encore construit avec Angular 21. Tailwind Labs a licencié 75 % de son équipe d'ingénierie en janvier 2026, mais les versions ont continué.

## 1. Point de départ vérifié

- Les deux fronts (`apps/front-office`, `apps/back-office`) dépendent d'Angular `^22.2.0` et n'ont aucune bibliothèque d'interface.
- TypeScript reste en 6.0 : `@angular/compiler-cli` 22.2.3 exige `typescript >=6.0 <6.1` ([registre npm](https://registry.npmjs.org/@angular/compiler-cli/22.2.3)). Angular 22.0.0 a abandonné les versions antérieures à 6.0 ([CHANGELOG Angular, 22.0.0](https://github.com/angular/angular/blob/main/CHANGELOG.md)).
- **Correction sur Agilometre.** Le projet voisin n'utilise pas seulement le CDK avec du CSS maison. Son front (`/home/arnaud/projets/agilometre/apps/frontend`) dépend surtout de `ng-zorro-antd` 22 (Ant Design pour Angular), importé dans 59 fichiers : modales, boutons, messages, champs, tableaux… Il utilise `@angular/cdk` pour le glisser-déposer et le défilement, et ses jetons CSS maison (`styles.scss`) doublent le thème Less de ng-zorro. Le commentaire en tête de `styles.scss` le précise lui-même : il faut modifier les deux fichiers à chaque changement de teinte. `ng-zorro-antd` 22.1.2 est sous licence MIT et accepte Angular `^22.0.0` ([registre npm](https://registry.npmjs.org/ng-zorro-antd/22.1.2)). Il n'est pas évalué ici, faute de figurer parmi les candidats du ticket.

## 2. Compatibilité avec Angular 22 et TypeScript 6.0

| Paquet | Version (date) | Peer dependencies Angular | Autres exigences | Licence |
|---|---|---|---|---|
| `@angular/material` | 22.2.3 (14/10/2026) | `^22.0.0 \|\| ^23.0.0` ; `@angular/cdk` 22.2.3 exact | — | MIT |
| `@angular/cdk` | 22.2.3 (14/10/2026) | `^22.0.0 \|\| ^23.0.0` | — | MIT |
| `@angular/aria` | 22.2.3 (14/10/2026) | `^22.0.0 \|\| ^23.0.0` ; `@angular/cdk` 22.2.3 | — | MIT |
| `primeng` | 22.1.3 (20/10/2026) | `^22.1.0` (dont `@angular/cdk`, `@angular/router`) | dépend de `@primeui/license-manager` | PrimeUI License |
| `@spartan-ng/brain` | 1.8.0 (16/10/2026) | `>=21.0.0 <23.0.0` (dont `@angular/cdk`, `@angular/forms`) | `tailwindcss >=4`, `clsx`, `luxon >=3`, `tw-animate-css` | MIT |
| `tailwindcss` | 4.3.3 (16/07/2026) | aucune | — | MIT |

Sources : métadonnées du registre npm pour chaque version ([material](https://registry.npmjs.org/@angular/material/22.2.3), [cdk](https://registry.npmjs.org/@angular/cdk/22.2.3), [aria](https://registry.npmjs.org/@angular/aria/22.2.3), [primeng](https://registry.npmjs.org/primeng/22.1.3), [brain](https://registry.npmjs.org/@spartan-ng/brain/1.8.0), [tailwindcss](https://registry.npmjs.org/tailwindcss/4.3.3)).

Constats complémentaires :

- **PrimeNG 21**, la dernière version MIT (21.1.10, 09/09/2026), exige `@angular/core ^21.0.7`. Elle ne peut donc pas servir avec Angular 22 sans forcer les peer dependencies ([registre npm](https://registry.npmjs.org/primeng/21.1.10)).
- **Tailwind** : `@angular/build` 22.2.3 déclare `tailwindcss ^2.0.0 || ^3.0.0 || ^4.0.0` en peer dependency optionnelle ([registre npm](https://registry.npmjs.org/@angular/build/22.2.3)). Le guide officiel propose `ng add tailwindcss` ([angular.dev, Tailwind](https://angular.dev/guide/tailwind)).
- **Spartan** est développé sur Angular 21 : au tag `v1.8.0` comme sur `main`, son `package.json` racine fixe `@angular/core` 21.2.16 et TypeScript 5.9.3 ([package.json de spartan-ng/spartan](https://github.com/spartan-ng/spartan/blob/main/package.json)). Ses peer dependencies plafonnent à `<23.0.0` : il faudra une nouvelle version de Spartan pour Angular 23.
- **CLI Spartan** : `@spartan-ng/cli` 1.8.0, qui copie les composants dans le projet, dépend de Nx (`nx`, `@nx/angular`, `@nx/devkit`…) et de `@schematics/angular` 21.2.14, même dans un projet Angular CLI ([registre npm](https://registry.npmjs.org/@spartan-ng/cli/1.8.0)). Le paquet `nx` déclare un script `postinstall`, que pnpm 12 bloquera tant qu'il ne figure pas dans `allowBuilds`.
- **Banc** : `pnpm install` de toutes ces versions ensemble (Angular 22.2.3, TypeScript 6.0.3) ne signale aucun conflit de peer dependencies, et les six variantes compilent en `strictTemplates`.

## 3. Poids ajouté au bundle

### Mesure

Écran identique dans chaque variante : un bouton « S'inscrire » ouvre un dialogue modal qui contient un champ pseudo, une liste de trois parties, une case « J'ai lu le règlement » et deux boutons. Un formulaire Signal Forms (`form()`, `required()`, `[formField]`) relie le tout, avec un thème sombre aux couleurs de la charte. Le build est celui de production d'`@angular/build` 22.2.3. L'« estimation de transfert » est celle d'Angular CLI, c'est-à-dire la taille compressée en Brotli (`calculateEstimatedTransferSizes`, `node_zlib.brotliCompress` dans `@angular/build/src/tools/esbuild/utils.js`).

| Variante | Ce qu'elle utilise | JS brut | CSS brut | Transfert estimé | Écart avec « natif » |
|---|---|---:|---:|---:|---:|
| Natif + CSS maison | `<dialog>` HTML, `input`, `select`, `checkbox` natifs | 193,2 ko | 1,2 ko | **54,0 ko** | — |
| Tailwind seul | même balisage, stylé par utilitaires | 193,7 ko | 6,1 ko | **55,7 ko** | +1,7 ko |
| CDK + CSS maison | `Dialog` du CDK, contrôles natifs | 268,2 ko | 2,9 ko | **72,2 ko** | +18,2 ko |
| Spartan (helm, style « nova ») | `hlm-dialog`, `hlm-select`, `hlm-checkbox`, `hlmInput`, `hlmBtn` | 445,6 ko | 35,3 ko | **115,2 ko** | +61,2 ko |
| Angular Material 3 | `MatDialog`, `mat-form-field`, `matInput`, `mat-select`, `mat-checkbox`, `matButton` | 545,9 ko | 9,1 ko | **119,6 ko** | +65,6 ko |
| PrimeNG, mode `unstyled` | `p-dialog`, `p-select`, `p-checkbox`, `pInputText`, `p-button`, sans thème | 593,3 ko | 0,1 ko | **137,1 ko** | +83,1 ko |
| PrimeNG, préréglage Aura | idem, thème Aura recoloré par `definePreset` | 710,8 ko | 0,1 ko | **149,8 ko** | +95,8 ko |

Répartition du JS minifié (avant compression) par paquet, tirée du metafile esbuild (`--stats-json`) :

- **CDK** : CDK 54 ko ; le framework passe de 176 à 193 ko.
- **Material** : Material 199 ko, CDK 98 ko, framework 225 ko.
- **Spartan** : CDK 78 ko, `@spartan-ng/brain` 60 ko, composants helm copiés dans l'application 29 ko, `tailwind-merge` 28 ko, framework 223 ko. Son CSS (35 ko bruts, 6 ko compressés) comprend le preflight de Tailwind, le preset Spartan (qui importe `tw-animate-css` et le CSS d'overlay du CDK) et les utilitaires utilisés.
- **PrimeNG (Aura)** : `primeng` 222 ko, `@primeuix/themes` 116 ko (le préréglage, qui définit les jetons de tous les composants), `@primeuix/styles` 47 ko, `@primeuix/utils` et `@primeuix/styled` 23 ko chacun, icônes 28 ko, `@primeui/license-manager` 18 ko, framework 211 ko. Les styles de PrimeNG voyagent dans le JavaScript (`@primeuix/styles`, `@primeuix/styled`) : le CSS global de la variante ne contient que les 81 octets écrits pour le banc.

### Limites de la mesure

- Un seul écran, chargé d'emblée. Avec un chargement différé (`@defer`, routes paresseuses), le coût passe dans un chunk secondaire, mais il reste téléchargé en 4G à la première utilisation.
- Les variantes ne rendent pas le même service. La liste déroulante native ne se stylise pas comme `mat-select` ou `p-select`. Le `<dialog>` natif gère lui-même l'inertie du reste de la page, la touche Échap et le focus initial ([MDN, `<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog), disponible partout depuis mars 2022), mais il ne restaure pas le focus à la fermeture comme le fait le `Dialog` du CDK.
- Spartan : le banc reproduit à la main ce que fait le CLI. Il copie les sources helm du tag `v1.8.0` et remplace les classes `spartan-*` par les utilitaires du style « nova » (`libs/registry/src/styles/style-nova.css`), comme `transformStyleMap` dans `libs/cli/src/generators/base/lib/styles/`. Ce remplacement est fidèle pour les règles simples ; quelques variantes arbitraires contenant des apostrophes peuvent ne pas être générées. `@ng-icons` y est en 36.1.0, alors que helm attend `<34`.
- Le marginal par composant supplémentaire n'est pas mesuré : un tableau, des onglets ou un menu ajouteraient des coûts propres à chaque bibliothèque.

## 4. Signal Forms

### État dans Angular 22

- **Stables depuis Angular 22.0.0** (3 juin 2026). Le CHANGELOG annonce « graduate signal forms APIs to public API » ([commit 7745365](https://github.com/angular/angular/commit/7745365910771d97c91e9b640c2c26a99bfa5a6d)). Dans `@angular/forms` 22.2.3, les déclarations de `@angular/forms/signals` portent `@publicApi 22.0` (`form`, `FormField`, `FormRoot`, validateurs, `FormValueControl`…). Une seule API reste `@experimental` : `provideExperimentalWebMcpForms`. Passer une fonction à `disabled`, `hidden` ou `readonly` est déprécié au profit de `{ when: … }` ([types publiés](https://unpkg.com/@angular/forms@22.2.3/types/signals.d.ts)).
- **Directives** : `[formField]` lie un champ ; `form[formRoot]` gère la soumission.
- **Contrôles acceptés par `[formField]`**, d'après la documentation de la directive ([types publiés](https://unpkg.com/@angular/forms@22.2.3/types/_structure-chunk.d.ts)) :
  1. un `input` ou un `textarea` natif (le code gère aussi `select`) ;
  2. un composant qui implémente `FormValueControl` (un `value` en `model()`) ou `FormCheckboxControl` ;
  3. un composant qui fournit un `ControlValueAccessor` : « This should only be used for backwards compatibility with reactive forms. Prefer options (1) and (2). »
- **Migration** : le point d'entrée `@angular/forms/signals/compat` (`compatForm`, `SignalFormControl`) fait cohabiter Signal Forms et formulaires réactifs.

### Intégration avec chaque option

| Option | Mécanisme | Constat |
|---|---|---|
| Natif, CDK + CSS maison, Tailwind seul | contrôles natifs, directement liés par `[formField]` ; contrôles maison par `FormValueControl` | Le banc lie `input`, `select` et `checkbox` sans code d'adaptation. |
| Angular Material 22 | intégration native : `matInput`, `mat-select`, le datepicker et les chips injectent le jeton `FORM_FIELD` de `@angular/forms/signals`. Le suivi d'état d'erreur accepte `NgControl \| FormField`. `mat-select` reste un `ControlValueAccessor` pour la valeur. | Correctifs successifs : « rework error state matcher to handle signal forms » ([22.0.4](https://github.com/angular/components/commit/c86b024e3f48b4a78aa6c3d041089683bfbba353)), « allow signal form to be assigned as stepControl » ([22.1.0](https://github.com/angular/components/commit/0e34c64d0cc96cd3cc8f19dea06f58a0ad4d8b59)), « support signal forms in MatFormFieldControl » ([22.2.0](https://github.com/angular/components/commit/42c72bf2ebb0a8ba0b38c5614814385b25df43e9)). |
| Angular Aria 22 | les directives Combobox, Listbox, Tree, Menu, Toolbar et Select exposent `value` | Renommage `values` → `value` en 22.0.0, « for signal forms compatibility » ([commit 94a50a2](https://github.com/angular/components/commit/94a50a25f95c0e28d661b957a0a17501cc9998f9)). |
| PrimeNG 22 | `ControlValueAccessor` uniquement : le jeton `NG_VALUE_ACCESSOR` apparaît 50 fois dans le code publié, `@angular/forms/signals` jamais | Fonctionne par la voie de compatibilité. |
| Spartan 1.8 | `ControlValueAccessor`. `@spartan-ng/brain/forms` contient un `SignalStateTracker` qui lit l'état du `NgControl` fourni par `FormField`. | La documentation Spartan montre `hlm-select` avec `[formField]` et `[formRoot]` (`select--form.preview.ts`, tag `v1.8.0`). |

**Vérification à l'exécution (banc, Chromium).** Dans les six variantes, « Valider » est désactivé à l'ouverture (pseudo et partie obligatoires). Après saisie, sélection et coche, il s'active, et le modèle vaut `Arnaud|p2|true`. La liaison contrôle → modèle fonctionne donc avec chaque bibliothèque. L'affichage des messages d'erreur dans les composants n'a pas été testé.

## 5. Thème sombre et jetons de couleur

| Option | Mécanisme | Palette exacte de la charte | Mode sombre |
|---|---|---|---|
| CDK + CSS maison | Aucun style fourni : jetons en propriétés CSS personnalisées, comme Agilometre (primitives, puis jetons sémantiques). | Oui, par construction. | À écrire (`color-scheme`, `prefers-color-scheme` ou classe). |
| Tailwind | Directive `@theme` : chaque variable (`--color-*`, `--font-*`) crée des utilitaires et devient une variable CSS ([doc Theme](https://tailwindcss.com/docs/theme)). | Oui (`--color-fond: #1b1031`…). | Variante `dark:`, par défaut sur `prefers-color-scheme`, ou sur une classe via `@custom-variant` ([doc Dark mode](https://tailwindcss.com/docs/dark-mode)). |
| Angular Material 3 | Mixin Sass `mat.theme()` (couleur, typographie, densité). Jetons système `--mat-sys-*`. Retouches par `mat.theme-overrides` et par les mixins `mat.<composant>-overrides` ([guide Theming](https://github.com/angular/components/blob/main/guides/theming.md)). | Les palettes M3 sont dérivées d'une couleur source par Material Color Utilities (12 palettes fournies, ou le schematic `ng generate @angular/material:theme-color`). Les teintes exactes s'imposent jeton par jeton par `$overrides` (le banc impose `surface: #1b1031`, `primary: #f072c8`…). | `color-scheme` et `light-dark()`, ou `theme-type: dark`. |
| PrimeNG 22 | Jetons en trois niveaux (primitive, sémantique, composant), préréglages Aura, Material, Lara et Nora, personnalisation par `definePreset` ([doc Styled mode](https://primeng.dev/theming/styled)). Un mode `unstyled` existe aussi. | Oui, en redéfinissant la palette `primary` (fait dans le banc). | `darkModeSelector` (par défaut `system`, ou une classe). |
| Spartan | Variables CSS façon shadcn (`--background`, `--primary`, `--ring`…), branchées sur le thème Tailwind par `@theme inline` dans `hlm-tailwind-preset.css`. | Oui, valeurs libres. | Classe `.dark` (`@custom-variant dark (&:is(.dark *))`). |

Deux limites documentées :

- **Material** : « Angular strongly discourages, and does not directly support, overriding component CSS outside the theming APIs ». Le DOM et les classes des composants sont des détails privés ([guide Theming, « Direct Style Overrides »](https://github.com/angular/components/blob/main/guides/theming.md)). On personnalise donc dans le cadre des jetons M3, sans redessiner les composants.
- **Police des titres (Aclonica)** : Material la prend en `brand-family` dans la typographie ; Tailwind et Spartan en jeton `--font-*` ; le CSS maison n'a aucune contrainte.

## 6. Accessibilité

| Option | Ce que la source affirme |
|---|---|
| Angular Material et CDK | Liste des lecteurs d'écran visés : NVDA et JAWS sous Windows, VoiceOver sous macOS et iOS, Android Accessibility Suite (ex-TalkBack), ChromeVox ([README angular/components](https://github.com/angular/components/blob/main/README.md)). Le `Dialog` du CDK applique `role="dialog"`, piège le focus et le restaure à la fermeture ([doc CDK Dialog](https://github.com/angular/components/blob/main/src/cdk/dialog/dialog.md)). `mat.strong-focus-indicators()` renforce l'indicateur de focus. Pour `mat-table`, passer en `role="grid"` n'ajoute ni gestion du clavier ni gestion du focus ([doc table](https://github.com/angular/components/blob/main/src/material/table/table.md)). |
| Angular Aria | Directives sans style qui implémentent les motifs WAI-ARIA : accordion, combobox, grid, listbox, menu, tabs, toolbar, tree. Elles sont sorties de developer preview en 22.0.0 ([commit 84f2afd](https://github.com/angular/components/commit/84f2afd24933c8742662ee6d12a6f3f98f5dea9e)). |
| PrimeNG | « PrimeNG targets AA level compliance on WCAG specification » et « aim high level of WCAG compliancy in the near future ». La page ne cite aucun audit ni test ([guide Accessibility, 22.1.3](https://primeng.dev/guides/accessibility)). |
| Spartan | Brain fournit « keyboard navigation, focus management, ARIA wiring » ([README de `@spartan-ng/brain`](https://www.npmjs.com/package/@spartan-ng/brain)). Des correctifs ARIA sont encore en cours, par exemple [#1789](https://github.com/spartan-ng/spartan/issues/1789), fermée le 08/10/2026 (`aria-activedescendant` absent de la combobox). |
| CSS maison, Tailwind | Aucun composant : l'accessibilité repose sur les éléments natifs (`<dialog>`, `<select>`…), sur le CDK ou Angular Aria, ou sur le code écrit. |

## 7. Composants du back office

### Tableau dense

- **Material** : `mat-table` (sur `cdk-table`), avec tri (`MatSort`), pagination (`MatPaginator`), filtrage, lignes et colonnes collantes, sélection et défilement virtuel dans un `cdk-virtual-scroll-viewport`. Avec le défilement virtuel, `fixedLayout` est forcé et les gabarits conditionnels `when` ne sont pas gérés ([doc table](https://github.com/angular/components/blob/main/src/material/table/table.md)). La densité du thème va de 0 à -5 ; Material prévient qu'une densité réduite peut nuire à l'accessibilité ([guide Theming](https://github.com/angular/components/blob/main/guides/theming.md)).
- **CDK seul** : `cdk-table`, même moteur, sans aucun style.
- **PrimeNG** : `p-table` est le plus fourni : défilement virtuel, colonnes figées et redimensionnables, édition, regroupement de lignes, mémorisation d'état (`virtualScroll`, `frozen`, `resizableColumns`, `editMode`, `rowGroupMode`, `stateStorage` dans `primeng-table.mjs`).
- **Spartan** : `hlm-table` ne fait que styliser un `<table>` natif (`libs/helm/table/src/lib/hlm-table.ts`). La « data table » de la documentation s'appuie sur `@tanstack/angular-table` (9.x, peer `@angular/core >=19`).
- **Tailwind seul** : rien de fourni.

### Dialogue

Tous les candidats en proposent un, sauf Tailwind seul (qui peut s'appuyer sur `<dialog>` natif ou sur le CDK). `MatDialog`, `Dialog` du CDK, `p-dialog` et `hlm-dialog` (construit sur le CDK) ont été montés dans le banc, avec Signal Forms.

### Glisser-déposer (grille de programmation créneaux × tables)

- **CDK `drag-drop`** : listes connectées, `cdkDropListOrientation="mixed"` pour les listes qui passent à la ligne, aperçu et placeholder personnalisables. Il écoute `mousedown` et `touchstart`, donc fonctionne au tactile ([guide Drag and drop](https://angular.dev/guide/drag-drop)). Il ne gère pas le clavier : le guide n'en dit rien, et la demande « Proposal for Keyboard and Screenreader Accessibility » ([#25468](https://github.com/angular/components/issues/25468)) est ouverte depuis le 15/08/2022. Le guide de `mat-table` montre son intégration pour réordonner lignes et colonnes.
- **Angular Aria, motif Grid** : navigation aux flèches, Début et Fin, sélection simple ou multiple et sélection de plages « with modifier keys or dragging » ([guide Grid](https://angular.dev/guide/aria/grid)). C'est une alternative au clavier pour une grille de programmation, pas un glisser-déposer.
- **PrimeNG** : directives `pDraggable` et `pDroppable`, fondées sur l'API HTML5 (`dragstart`, `dragover`, `drop` dans `primeng-dragdrop.mjs`), sans gestion du clavier.
- **Spartan, Tailwind** : rien de dédié ; on utiliserait le CDK.

## 8. Licence, maintenance et pérennité

### PrimeNG : changement de licence

- **Licence 22.x** : le `LICENSE.md` du paquet décrit la « PrimeUI License », « a family of commercial UI libraries by PrimeTek Informatics ». Il existe deux licences : Community (gratuite, sous conditions) et Commercial (payante). « A valid license key is required to use this software. » Le paquet est « distributed as a compiled package ». Il est interdit de le décompiler ou de retirer ses mécanismes de licence ([LICENSE.md de primeng 22.1.3](https://unpkg.com/primeng@22.1.3/LICENSE.md)).
- **Conditions Community** (page du 26/08/2026, [primeui.dev/licenses/community](https://primeui.dev/licenses/community)) :
  - moins de 5 développeurs au total, moins de 10 salariés, moins d'un million de dollars de revenus (de budget pour une structure à but non lucratif), au plus 3 millions de dollars de capitaux extérieurs ;
  - « Non-profit status on its own does not confer eligibility » ;
  - exclusion des organismes « government-funded » et du secteur public ;
  - 4 postes de développeur au plus ; licence valable 12 mois, renouvelable gratuitement, avec 30 jours de grâce.
- **Contradiction entre sources** : le `LICENSE.md` du paquet affirme au contraire que « Individuals, students, non-profits, and non-commercial open source projects also qualify ».
- **Effet concret d'une clé expirée** : le code de `@primeui/license-manager` 1.1.0 compare la date du jour à l'expiration de la clé, à laquelle il ajoute 30 jours pour une clé Community. Une fois ce délai passé, la vérification renvoie `expired` ([index.mjs](https://unpkg.com/@primeui/license-manager@1.1.0/dist/index.mjs)). `providePrimeNG` affiche alors le bandeau « Invalid PrimeUI License » ([primeng-config.mjs](https://unpkg.com/primeng@22.1.3/fesm2022/primeng-config.mjs), [primeng-license.mjs](https://unpkg.com/primeng@22.1.3/fesm2022/primeng-license.mjs)). Il apparaît donc en production même si l'application n'a pas changé, tant qu'une nouvelle clé n'est pas intégrée et déployée. Le banc, sans clé, affiche ce bandeau et l'avertissement « PrimeUI license is not configured ».
- **Code source et suivi** : le dépôt `primefaces/primeng` annonce « no longer under active development and receives security fixes only », avec des issues en lecture seule. Les versions MIT existantes restent MIT ([README](https://github.com/primefaces/primeng)). Les versions majeures suivantes sont « distributed as compiled npm packages » et « no longer released as open source ». La licence Commercial coûte 599 $ par développeur jusqu'à fin 2026, puis 799 $ ([primeui.dev/nextchapter](https://primeui.dev/nextchapter)).
- **Rythme de publication** : sur npm, 22.0.0 (15/07), 22.1.0 (18/08), 22.1.1 (09/09), 22.1.2 (29/09), 22.1.3 (20/10/2026).

### Les autres options

| Option | Éditeur | Activité constatée | Horizon |
|---|---|---|---|
| Angular Material, CDK, Aria | Équipe Angular (Google) | Une version par semaine (22.2.0 le 23/09, 22.2.1 le 30/09, 22.2.2 le 07/10, 22.2.3 le 14/10/2026), au moins 100 commits depuis le 21/07/2026 ([CHANGELOG](https://github.com/angular/components/blob/main/CHANGELOG.md)). | Même politique de support qu'Angular ([README](https://github.com/angular/components/blob/main/README.md)) : v22 active jusqu'en juin 2027, LTS jusqu'en juin 2028. Depuis la v22, Angular sort une version majeure par an ; v23 vers juin 2027 ([angular.dev, Releases](https://angular.dev/reference/releases)). Les peer dependencies de Material 22 acceptent déjà `^23.0.0`. |
| Spartan | Communauté open source (MIT) | 1.0.0 le 24/06/2026 après une longue série d'alphas (depuis décembre 2024). 25 versions stables depuis, la dernière le 16/10/2026. 2 952 étoiles, 96 issues et PR ouvertes, au moins 100 commits depuis le 21/07/2026. Principaux contributeurs : marcjulian, ashley-hunter, MerlinMoos, goetzrobin. | Développé sur Angular 21 ; peer dependencies `<23.0.0`. Les composants helm sont copiés dans le projet, et le CLI fournit des migrations (une trentaine de générateurs `migrate-*`). |
| Tailwind CSS | Tailwind Labs (MIT) | 4.3.3 le 16/07/2026, aucune version depuis ; 66 commits depuis le 21/07/2026 ([releases](https://github.com/tailwindlabs/tailwindcss/releases)). | Le 07/01/2026, Adam Wathan (Tailwind Labs) écrit que « 75% of the people on our engineering team lost their jobs here yesterday because of the brutal impact AI has had on our business » ([commentaire GitHub](https://github.com/tailwindlabs/tailwindcss.com/pull/2388#issuecomment-3717222957)). Neuf versions sont sorties depuis, de 4.2.0 (18/02/2026) à 4.3.3. |
| CSS maison | Le projet | — | Aucune dépendance externe : la charge de maintenance repose sur l'équipe. |

## 9. Tableau comparatif

Transfert mesuré sur l'écran du banc (§ 3). « Natif » signifie que le contrôle HTML est lié directement.

| Critère | Material 3 (+ CDK) | CDK + CSS maison (+ Aria) | PrimeNG 22 | Spartan 1.8 (+ Tailwind) | Tailwind seul |
|---|---|---|---|---|---|
| Angular 22 / TS 6.0 | Oui, accepte déjà v23 | Oui, accepte déjà v23 | Oui (`^22.1.0`) | Oui (`<23`), dépôt développé sur v21 | Oui (peer optionnelle d'`@angular/build`) |
| Transfert du banc | 119,6 ko (+65,6) | 72,2 ko (+18,2) | 137,1 à 149,8 ko (+83 à +96) | 115,2 ko (+61,2) | 55,7 ko (+1,7) |
| Thème sombre | `color-scheme`, `theme-type` | à écrire | `darkModeSelector` | classe `.dark` | variante `dark:` |
| Couleurs exactes de la charte | par `$overrides` sur palettes M3 dérivées | libres | `definePreset` | variables CSS libres | `@theme` libre |
| Liberté de dessin | cadrée par M3 ; pas de CSS hors API de thème | totale | jetons sur trois niveaux, ou mode `unstyled` | totale (code copié dans le projet) | totale |
| Accessibilité | lecteurs d'écran visés et listés ; focus géré | primitives CDK et Aria (WAI-ARIA) ; reste à notre charge | « targets AA », sans test cité | primitives brain (clavier, focus, ARIA) | à notre charge |
| Tableau dense | `mat-table` + tri, pagination, virtuel | `cdk-table` sans style | `p-table` très complet | `hlm-table` (style) + TanStack Table | — |
| Dialogue | `MatDialog` | `Dialog` du CDK ou `<dialog>` | `p-dialog` | `hlm-dialog` (sur CDK) | `<dialog>` natif |
| Glisser-déposer | CDK drag-drop (pas de clavier) | CDK drag-drop (pas de clavier) ; Aria Grid pour le clavier | `pDraggable` HTML5 (pas de clavier) | CDK drag-drop | — |
| Signal Forms | intégration native (`FORM_FIELD`), vérifiée | contrôles natifs ou `FormValueControl`, vérifié | par CVA (compatibilité), vérifié | par CVA + `SignalStateTracker`, vérifié | contrôles natifs, vérifié |
| Licence | MIT | MIT | commerciale ; Community gratuite sous conditions, clé annuelle | MIT | MIT |
| Maintenance | Google, une version par semaine | Google, une version par semaine | PrimeTek, code fermé, environ une version par mois | communauté, 1.x depuis juin 2026 | Tailwind Labs, équipe réduite en 2026 |

## 10. Faits qui pèsent sur la décision

À trancher dans #10. Les faits ci-dessous ne sont pas classés par ordre d'importance.

- **Le front office n'exige pas la même option que le back office.** Les mesures séparent nettement deux groupes : moins de 20 ko ajoutés (natif, Tailwind, CDK) et plus de 60 ko (Spartan, Material, PrimeNG). Le PRD demande des « pages légères » sur « réseau mobile uniquement » (§ 6) pour le front office, et vise l'ordinateur pour le back office.
- **PrimeNG 22 impose une clé de licence et sa gestion annuelle.** L'éligibilité de l'association à la licence Community n'est pas évidente : le statut associatif ne suffit pas, et les organismes « government-funded » sont exclus, ce qui pose la question des subventions publiques. Une clé non renouvelée affiche un bandeau en production. Les sources de PrimeTek se contredisent sur les structures à but non lucratif.
- **Le CDK est commun à Material, Spartan et à l'option CDK + CSS maison.** Le glisser-déposer de la grille de programmation passera presque sûrement par `@angular/cdk/drag-drop`, quelle que soit l'option. Son absence de gestion du clavier se compense par un autre mode de saisie (Angular Aria Grid, menus, dialogues).
- **Material contraint le dessin.** Son API de thème personnalise les jetons M3, et Angular déconseille de styliser les composants en dehors. Une identité visuelle marquée (Aclonica, violet et magenta) reste donc dans le cadre visuel de Material Design 3.
- **Spartan et Tailwind rendent le code de style local.** Les composants helm sont copiés dans le dépôt. Tailwind, seul ou sous Spartan, ajoute une chaîne PostCSS. Le CLI Spartan tire Nx et ses scripts d'installation.
- **Signal Forms fonctionnent partout.** Seul Material lit nativement l'état d'erreur d'un champ Signal Forms. PrimeNG et Spartan passent par la voie que la documentation d'Angular réserve à la compatibilité.
- **Rythme des versions.** Angular passe à une version majeure par an : v23 vers juin 2027, peut-être avant la convention selon sa date. Material, le CDK et Aria acceptent déjà v23 ; Spartan et PrimeNG devront publier une nouvelle version.
- **Agilometre n'est pas un précédent « CDK + CSS maison ».** Il repose sur ng-zorro-antd, ce qui oblige à tenir à jour deux systèmes de thème parallèles.

### Questions ouvertes pour #10

1. Une seule option pour les deux fronts, ou une option par front ?
2. Si PrimeNG reste candidat : l'association reçoit-elle des fonds publics, et qui gérerait la clé annuelle ?
3. Quel mode de saisie au clavier pour la grille de programmation : glisser-déposer seul, ou doublé d'un mode clavier ?
4. Quelle part de dessin maison accepter ? D'un côté, une identité propre qui demande plus de CSS à écrire ; de l'autre, Material Design 3 recoloré.

## Annexe : banc de mesure

Le banc est jetable et n'est pas versionné. Il suffit de le reconstruire pour reproduire les chiffres.

- **Espace Angular CLI** à six projets (`natif`, `cdk`, `material`, `primeng`, `tailwind`, `spartan`), avec le `tsconfig` des fronts du projet plus `strictTemplates: true`. Dépendances exactes : Angular 22.2.3, `@angular/build` 22.2.3, TypeScript 6.0.3, `@angular/material` et `@angular/cdk` 22.2.3, `primeng` 22.1.3, `@primeuix/themes` 3.0.2, `@spartan-ng/brain` 1.8.0, `tailwindcss` et `@tailwindcss/postcss` 4.3.3.
- **Modèle commun** :

  ```ts
  const modele = signal({ pseudo: '', partie: '', accord: false });
  form(modele, (chemin) => {
    required(chemin.pseudo);
    required(chemin.partie);
  });
  ```

  Les trois contrôles sont liés par `[formField]`, et « Valider » est désactivé tant que `inscription().invalid()`.
- **Thèmes** :
  - Material : `mat.theme()` avec `theme-type: dark`, `density: -2` et `$overrides` sur `surface`, `surface-container`, `primary` et `primary-container`.
  - PrimeNG : `definePreset(Aura, …)` sur la palette `primary`, avec `darkModeSelector: '.sombre'`.
  - Spartan : variables shadcn sous `.dark`.
  - Tailwind : `@theme` avec les couleurs de la charte et `--font-titre`.
  - CSS maison : propriétés personnalisées sur `:root`.
  - Tailwind et Spartan limitent le scan à leur projet (`@import 'tailwindcss' source('.')`).
- **Mesures** : `ng build <variante>` (production), avec lecture du tableau « Initial total » ; ventilation par paquet à partir de `browser-stats.json` (`--stats-json`, champ `bytesInOutput`).
- **Test à l'exécution** : Playwright 1.64.1 et Chromium, sur un serveur statique. Pour chaque variante, le test ouvre le dialogue, relève l'état de « Valider », remplit le pseudo, choisit « Le Manoir Hurlant » par le composant de la bibliothèque, coche la case, puis relève à nouveau « Valider » et l'état du modèle.
