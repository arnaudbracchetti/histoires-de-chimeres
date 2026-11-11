# QR code de l'affiche : bibliothèque et taille minimale

Recherche menée pour le ticket [#151](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/151), sous-ticket de #150. Elle prépare #152 : ce document rassemble des faits et finit par une recommandation, la décision revient à l'utilisateur.

État au 11 novembre 2026.

## Question

1. Quelle bibliothèque génère un QR code en SVG dans le navigateur : légère, sans dépendance ou presque, maintenue, en ESM, compatible avec Angular 22 et Vite, sous licence libre ? Elle vivra dans `packages/design`, sur sa propre entrée (comme `@chimeres/design/presentation`).
2. Quel niveau de correction d'erreur, et quelle taille minimale, pour un scan fiable à 1–2 m, sur une affiche A4 ou A3 imprimée et sur un écran d'ordinateur ?

Contenu encodé : une URL courte du type `https://<domaine>/?<param>=ABCD`.

## Méthode

- **Sources primaires uniquement** : registre npm (métadonnées et contenu des paquets publiés), dépôts GitHub (code source, API), Denso Wave (inventeur du QR code, site qrcode.com), fiche ISO de la norme, documentation officielle de Google (ML Kit, fiches techniques des Pixel).
- **Mesure du poids** : chaque paquet a été téléchargé hors du dépôt, sans installation dans le monorepo. Pour chacun, un fichier d'entrée produit le SVG d'une même URL (`https://test2.nekbet.fr/?code=ABCD`, niveau M, marge de 4 modules). Il est empaqueté par l'esbuild 0.28.2 du monorepo (`--bundle --minify --format=esm --platform=browser`), puis compressé en gzip -9 et en Brotli. Les chiffres comptent donc ce qui reste après tree-shaking.
- **Capacités** : calculées à partir des tables de la norme recopiées dans le code source de `qr` 0.7.2 (`src/index.ts`, tables 1 et 9 d'ISO/IEC 18004:2024). Elles concordent avec la table de capacité connue de la norme.
- La norme [ISO/IEC 18004:2024](https://www.iso.org/standard/83389.html) (4e édition, août 2024, payante) n'a pas été lue en entier. Ses exigences sont citées à travers Denso Wave et le code source qui la référence par article.

## Résumé des faits

1. **Cinq candidates** sous licence MIT (ou MIT/Apache-2.0), toutes sans dépendance sauf `qrcode`. Après tree-shaking et Brotli : `lean-qr` 3,9 ko (2,5 ko en version « nano »), `uqr` 3,8 ko, `qr` 6,1 ko, `qrcode-generator` 6,7 ko, `qrcode` 8,6 ko.
2. **Maintenance** : `lean-qr` (dernier commit le 10/11/2026) et `qr` (28/09/2026) sont actifs ; `uqr` a publié en avril 2026 ; `qrcode-generator` n'a pas publié depuis août 2025 ; `qrcode` n'a rien publié depuis août 2024 et reste en CommonJS.
3. **Version du QR** : une URL de 34 à 42 caractères tient en version 3 (29 × 29 modules) au niveau M, mais passe en version 4 (33 × 33) au niveau Q ou H. Monter de M à Q grossit donc le symbole de 14 %, ou réduit d'autant la taille de chaque module à surface égale.
4. **Marge** : la norme impose une zone vierge de 4 modules autour du symbole. Les bibliothèques n'ont pas toutes ce défaut : `qr` met 2 modules par défaut, `uqr` 1.
5. **Taille** : aucune norme ne fixe de distance de lecture. Le calcul à partir de la règle de ML Kit (2 pixels par module au minimum) et du champ de vision d'un téléphone actuel donne, pour 2 m, un symbole d'au moins 13 cm de côté (sans la marge), et d'environ 19 cm pour garder de la réserve.

## 1. Les candidates

| Paquet | Version (date) | Dépendances | Format | Licence | Dépôt : dernier commit, étoiles, issues ouvertes |
|---|---|---|---|---|---|
| [`lean-qr`](https://registry.npmjs.org/lean-qr) | 2.7.4 (07/09/2026) | aucune | ESM + CJS, entrées `./nano`, `./extras/svg` | MIT | [davidje13/lean-qr](https://github.com/davidje13/lean-qr) : 10/11/2026, 61, 2 |
| [`uqr`](https://registry.npmjs.org/uqr) | 0.1.3 (03/04/2026) | aucune | ESM + CJS | MIT | [unjs/uqr](https://github.com/unjs/uqr) : 03/04/2026, 787, 0 |
| [`qr`](https://registry.npmjs.org/qr) | 0.7.2 (28/09/2026) | aucune | ESM seul, entrées `./dom.js`, `./decode.js` | MIT ou Apache-2.0 | [paulmillr/qr](https://github.com/paulmillr/qr) : 28/09/2026, 391, 4 |
| [`qrcode-generator`](https://registry.npmjs.org/qrcode-generator) | 2.0.4 (07/08/2025) | aucune | ESM (`dist/qrcode.mjs`) + CJS | MIT | [kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) : 07/08/2025, 2 388, 65 |
| [`qrcode`](https://registry.npmjs.org/qrcode) | 1.5.4 (05/08/2024) | `dijkstrajs`, `pngjs`, `yargs` | CommonJS seul (`browser` remplace `lib/index.js`) | MIT | [soldair/node-qrcode](https://github.com/soldair/node-qrcode) : 05/08/2024, 8 190, 128 |

Sources : registre npm (`dist-tags.latest`, `time`, `dependencies`, `exports`) et API GitHub (`repos/<dépôt>`, `commits?per_page=1`), relevés le 11/11/2026.

Constats complémentaires :

- **`@paulmillr/qr`** est l'ancien nom de `qr` : sa dernière version (0.3.0) est dépréciée avec le message « Switch to "qr" (new package name) for security updates » ([registre npm](https://registry.npmjs.org/@paulmillr%2fqr)).
- **`qr`** exige Node `>= 20.19.0` (`engines`) et se dit écrit d'après ISO/IEC 18004:2024, dont il cite les articles dans son code. Il embarque aussi un décodeur, sur une entrée séparée qu'on n'importe pas.
- **`uqr`** reprend l'algorithme de [nayuki/QR-Code-generator](https://github.com/nayuki/QR-Code-generator), d'après son README. Il est en 0.x. Ses téléchargements hebdomadaires (9,9 millions) viennent surtout de l'écosystème unjs/Nuxt.
- **`qrcode`** : ses dépendances `pngjs` et `yargs` ne servent qu'à Node et à sa CLI ; le champ `browser` les écarte du bundle, mais pas `dijkstrajs`. Son format CommonJS déclenche un avertissement d'Angular CLI, sauf à l'ajouter à `allowedCommonJsDependencies` ([angular.dev](https://angular.dev/tools/cli/build#configuring-commonjs-dependencies)).
- **`qr-code-styling`** (QR décorés, logos) a été écarté : il dépend de `qrcode-generator` 1.x et pèse 516 ko décompressé ([registre npm](https://registry.npmjs.org/qr-code-styling)).

## 2. Poids ajouté au bundle

Mesure décrite dans la [méthode](#méthode) : le code réellement embarqué pour produire une chaîne SVG.

| Paquet (import) | Minifié | gzip -9 | Brotli |
|---|---:|---:|---:|
| `lean-qr/nano` + `lean-qr/extras/svg` | 4,7 ko | 2,7 ko | **2,5 ko** |
| `lean-qr` + `lean-qr/extras/svg` | 7,8 ko | 4,2 ko | **3,9 ko** |
| `uqr` (`renderSVG`) | 10,8 ko | 4,2 ko | **3,8 ko** |
| `qr` (`encodeQR(…, 'svg')`) | 14,8 ko | 6,7 ko | **6,1 ko** |
| `qrcode-generator` (`createSvgTag`) | 21,0 ko | 7,6 ko | **6,7 ko** |
| `qrcode` (`toString({ type: 'svg' })`) | 24,9 ko | 9,6 ko | **8,6 ko** |

Le README de `lean-qr` annonce « less than 4kB compressed » et environ 2 ko pour `nano` : la mesure le confirme. Sur une entrée séparée de `packages/design`, chargée seulement par l'écran de l'affiche, ces écarts de quelques kilo-octets n'ont pas d'effet sur le chargement initial.

## 3. L'API SVG

| Paquet | Appel | Correction d'erreur | Marge par défaut | Forme du SVG |
|---|---|---|---|---|
| `lean-qr` | `toSvgSource(generate(url, { minCorrectionLevel: correction.M }), { pad: 4 })` (chaîne), `toSvg(code, document)` (élément DOM), `toSvgPath(code)` (attribut `d` seul) | `minCorrectionLevel` / `maxCorrectionLevel` ; par défaut, part de L et monte tant que la version choisie a de la place | 4 modules | un seul `<path>` qui suit les contours : pas de jointure entre modules |
| `uqr` | `renderSVG(url, { ecc: 'M', border: 4 })` | `ecc`, défaut `'L'` ; `boostEcc` pour monter tant que la version le permet | **1 module** | un carré `M…h…v…h…z` par module noir, dans un seul `<path>` |
| `qr` | `encodeQR(url, 'svg', { ecc: 'medium', border: 4 })` | `ecc`, défaut `'medium'` | **2 modules** (refuse 0) | contours fusionnés (`optimize`, actif par défaut) |
| `qrcode-generator` | `qrcode(0, 'M')`, `addData(url)`, `make()`, `createSvgTag({ margin })` | 2e argument du constructeur | `cellSize × 4` (4 modules) | accepte `alt` et `title`, qui deviennent `<title>` / `<desc>` |
| `qrcode` | `QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M' })` (promesse) | `errorCorrectionLevel`, défaut `'M'` | 4 modules | un `<path>` |

Sources : déclarations de types et code des paquets publiés (`lean-qr/index.d.ts` et `extras/svg.mjs`, `uqr/dist/index.d.ts` et `index.mjs`, `qr/index.d.ts` et `src/index.ts` l. 1181 et 1233, `qrcode-generator/dist/qrcode.d.ts` et `qrcode.mjs`, `qrcode/lib/renderer/utils.js` l. 40).

Remarques :

- **`uqr`** dessine un carré par module. À un agrandissement non entier, l'anticrénelage peut laisser de fins liserés clairs entre deux modules voisins ; `shape-rendering="crispEdges"` les évite. `lean-qr` et `qr` tracent les contours de chaque zone noire et n'ont pas ce défaut.
- **`lean-qr`** documente `padX` et `padY` comme dépréciés au profit de `pad`. Sa variante `nano` ne garde que `minCorrectionLevel` et `minVersion` comme options.
- Les cinq produisent une chaîne, à insérer dans le DOM. `lean-qr` produit aussi un élément SVG directement (`toSvg`) ou le seul tracé (`toSvgPath`), qu'un gabarit Angular peut placer dans son propre `<svg>` : aucun `innerHTML` à assainir.
- **Pour `packages/design`** : le paquet est compilé par `tsc`, et `ng serve` ne pré-bundle pas `@chimeres/design`. Vite résout donc la dépendance depuis le front : comme `marked` aujourd'hui, le front qui affiche l'affiche devra la déclarer aussi (piège noté dans `CLAUDE.md`).

## 4. Correction d'erreur et version

### Ce que dit la source

Denso Wave ([Error correction feature](https://www.qrcode.com/en/about/error_correction.html)) : le niveau M (15 % de codewords restaurables) est « most frequently selected » ; Q (25 %) ou H (30 %) se choisissent pour un environnement d'usine où le code se salit ; L (7 %) pour un environnement propre et beaucoup de données.

Une affiche et un écran sont des supports propres. Le risque ne vient pas d'une salissure, mais du flou, d'un reflet (pochette plastique, vitre, écran brillant) ou d'un angle : il se traite surtout par la taille des modules.

### Capacité en mode octet (URL en minuscules)

Calculée d'après les tables 1 et 9 de la norme, telles que `qr` les recopie.

| Version (modules) | L | M | Q | H |
|---|---:|---:|---:|---:|
| 2 (25 × 25) | 32 | 26 | 20 | 14 |
| 3 (29 × 29) | 53 | **42** | 32 | 24 |
| 4 (33 × 33) | 78 | 62 | **46** | 34 |
| 5 (37 × 37) | 106 | 84 | 60 | 44 |

Exemples :

| URL | Longueur | L | M | Q | H |
|---|---:|---|---|---|---|
| `https://test2.nekbet.fr/?code=ABCD` | 34 | v3 | v3 | v4 | v4 |
| `https://chimeres.example.org/?c=ABCD` | 36 | v3 | v3 | v4 | v5 |
| `https://histoires-de-chimeres.fr/?code=ABCD` | 43 | v3 | v4 | v4 | v5 |

- Jusqu'à **42 caractères**, l'URL tient en version 3 au niveau M. Le domaine de production n'est pas encore fixé (`.env.prod.example` donne `chimeres.example.org`) : un nom de paramètre d'une lettre laisse de la marge.
- Le mode alphanumérique, plus dense, ne s'applique pas : son jeu de caractères (table 5 de la norme, recopiée dans `qr`) ne contient ni `?` ni `=`.
- `lean-qr` (par défaut) et `uqr` (avec `boostEcc`) montent d'eux-mêmes le niveau tant que la version reste la même : à 34 caractères en version 3, Q ne tient pas (32), le code reste en M.

## 5. Taille minimale pour un scan à 1–2 m

### Ce qui est fixé par une source

- **Zone vierge** : « QR Code requires a four-module wide margin at all sides of a symbol » ([Denso Wave, How to use](https://www.qrcode.com/en/howto/code.html) ; ISO/IEC 18004:2024 §5.3.8, cité dans `qr/src/index.ts`). Un symbole de version 3 occupe donc 37 modules de côté avec sa marge.
- **Résolution à la lecture** : pour ML Kit (le lecteur de codes de Google), « the smallest meaningful unit of the barcode should be at least 2 pixels wide, and for 2-dimensional codes, 2 pixels tall ». Google recommande une image de 1280 × 720 ou 1920 × 1080 pour lire de plus loin ([ML Kit, Barcode scanning, Input image guidelines](https://developers.google.com/ml-kit/vision/barcode-scanning/android)).
- **Champ de vision** : la caméra principale d'un téléphone actuel couvre 82° (Pixel 10a) à 85° (Pixel 11) en diagonale ([fiches techniques Pixel](https://support.google.com/pixelphone/answer/7158570?hl=en)).
- Aucune source primaire consultée ne donne de distance de lecture. La norme fixe le symbole et la qualité d'impression, pas l'usage.

### Calcul

Hypothèses : champ de 82° en diagonale sur un capteur 4:3, soit environ 70° sur le grand côté ; le flux vidéo de l'appareil photo couvre ce grand côté.

| Distance | Largeur vue | mm par pixel en 1280 px | mm par pixel en 1920 px |
|---:|---:|---:|---:|
| 1 m | 1,39 m | 1,09 | 0,72 |
| 2 m | 2,78 m | 2,17 | 1,45 |

Côté du symbole de version 3 (29 modules, sans la marge) :

| Distance | 2 px/module, flux 1920 | 2 px/module, flux 1280 | 3 px/module, flux 1280 |
|---:|---:|---:|---:|
| 1 m | 4,2 cm | 6,3 cm | 9,5 cm |
| 2 m | 8,4 cm | 12,6 cm | **18,9 cm** |

Le seuil de 2 pixels vaut pour une image nette et de face. La troisième colonne garde une réserve de 50 % pour le flou de mise au point, l'angle et l'éclairage. Ce calcul est une estimation : il se vérifie en imprimant une épreuve et en la scannant à 2 m avec deux ou trois téléphones.

### Affiche imprimée

| Format | Côté du symbole (sans marge) | Module | Avec la marge de 4 modules | Lecture attendue |
|---|---:|---:|---:|---|
| A4 (21 × 29,7 cm) | ≥ 13 cm | ≈ 4,5 mm | ≈ 16,6 cm | 2 m avec un flux 1280, au seuil ; avec réserve jusqu'à ≈ 1,4 m |
| A3 (29,7 × 42 cm) | ≥ 19 cm | ≈ 6,5 mm | ≈ 24,2 cm | 2 m avec réserve |

- Le SVG est vectoriel : il reste net à toute taille d'impression.
- Modules sombres sur fond clair, sans la couleur de la charte : c'est le cas que montrent toutes les sources citées. Le contraste inversé n'a pas été vérifié ici.
- Papier mat de préférence : un reflet sur un module efface autant qu'une tache.

### Écran d'ordinateur

- La même règle s'applique : à 2 m, il faut environ 13 cm de symbole au minimum, et 19 cm avec réserve. Sur un écran de portable de 13 à 14 pouces (environ 17 à 19 cm de haut), le QR doit occuper presque toute la hauteur ; sur un écran de bureau de 24 pouces (environ 30 cm de haut), 70 % de la hauteur suffit.
- Les tailles CSS en `cm` ne correspondent pas aux centimètres réels de l'écran : mieux vaut dimensionner le QR par rapport à la fenêtre (`min(80vh, 80vw)`).
- Un module doit couvrir un nombre entier de pixels pour garder des bords francs : `shape-rendering="crispEdges"` sur le `<svg>`.
- Luminosité de l'écran au maximum, et fond blanc autour, pour la zone vierge.

## Recommandation

1. **Bibliothèque : `lean-qr`** (2.7.4, MIT, aucune dépendance, ESM). C'est la plus légère (3,9 ko Brotli, 2,5 ko en `nano`), la plus récemment maintenue, et elle seule produit au choix une chaîne, un élément DOM ou un simple tracé `d`, que le gabarit place dans son propre `<svg>` sans `innerHTML`. Sa marge par défaut est la marge normative de 4 modules. Seconde option : `uqr`, aussi légère et deux fois plus étoilée, mais en 0.x, avec une marge de 1 module par défaut et un carré par module. Elle s'ajoute à `packages/design` sur une entrée séparée (par exemple `@chimeres/design/qr-code`), et le front concerné la déclare aussi.
2. **Correction d'erreur : M**, ce qui garde la version 3 (29 × 29) jusqu'à 42 caractères. Q ferait passer en version 4 et rapetisserait les modules de 14 % pour une affiche de même taille. Un paramètre d'URL d'une lettre (`?c=ABCD`) garde de la marge pour le domaine de production.
3. **Taille** : un symbole d'au moins **13 cm** de côté sur A4, de **19 cm** sur A3, avec une zone vierge de 4 modules autour (environ 2 à 3 cm). À l'écran, le QR occupe 80 % du plus petit côté de la fenêtre.
4. **À vérifier avant de figer** : imprimer une épreuve A4 et la scanner à 1 et 2 m avec un iPhone et un Android, de face puis de biais.
