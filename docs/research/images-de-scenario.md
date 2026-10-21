# Images de scénario : redimensionnement et stockage

Recherche du ticket [#14](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/14), sous-issue de la carte #1. Elle prépare la décision du ticket #15, qui reste à prendre : ce document expose les faits et les options, sans trancher.

**Question** : comment redimensionner, compresser, stocker et servir l'image d'un scénario dans notre pile ? D'après PR-7, le serveur redimensionne et compresse l'image (ordre de grandeur : 100 Ko), et une illustration par défaut s'affiche quand il n'y en a pas. Le PRD §6 ajoute que le front office ne dispose sur place que du réseau mobile, et que le programme doit rester consultable hors ligne.

Faits relevés le 21 octobre 2026. Versions vérifiées dans `pnpm-lock.yaml` : `@nestjs/*` 12.2.0 (le ticket parle de NestJS 11, mais le projet est en 12), `express` 5.3.0, `multer` 2.4.0, `@angular/service-worker` 22.2.3, Prisma 7.10.1, PostgreSQL 17 (`postgres:17-alpine`), pnpm 12.6.0. Dernière version de sharp sur npm : 0.35.5 (27 septembre 2026).

Chaque fait est suivi de sa source, numérotée et listée en fin de document. La mention **[vérifié]** signale une expérience menée pour cette recherche, dans un conteneur `node:22-slim`.

## Synthèse

- **sharp 0.35.5** s'installe avec pnpm 12 dans `node:22-slim` sans rien ajouter à `allowBuilds`. Il n'a aucun script d'installation, et ses binaires précompilés (libvips comprise) arrivent par des dépendances optionnelles. Coût : environ 20 Mo dans l'image.
- **Les alternatives sans binaire natif** sont jeunes, ou peu adaptées à Node. Le plugin WebP de Jimp échoue sous Node 22 sans préparation manuelle.
- **WebP et AVIF** sont pris en charge sans réserve par Safari iOS 16.4 et plus, et WebP dès iOS 14. Sur une photo réelle de 2725×2225 px, en 1200 px de large : WebP q80 ≈ 103 Ko en ~0,2 s ; AVIF q50 ≈ 59 Ko en ~4 s ; JPEG mozjpeg q80 ≈ 130 Ko.
- **Stockage** : le ticket #2 a tranché que chaque convention repart d'une base vide. Avec `bytea`, les images partent avec la base et se sauvegardent avec elle. Un volume Docker ajoute une deuxième sauvegarde et une deuxième purge. Le stockage objet ajoute un service externe, pour quelques Mo de données.
- **Envoi** : NestJS 12.2 s'appuie sur multer 2.4.0. `limits.fileSize` renvoie un 413. `FileTypeValidator` lit les magic numbers (paquet `file-type`), pas le type déclaré par le navigateur. Le décodage par sharp reste la vérification finale.
- **Service et hors-ligne** : le groupe `assets` actuel de `ngsw-config.json` ne couvre pas les images servies par l'API. Il faut un `assetGroup` par `resources.urls`, ou un `dataGroup`. Une URL qui change avec l'image permet `Cache-Control: max-age=31536000, immutable`. Le service worker ne met en cache que les images déjà demandées.

## 1. Redimensionnement côté serveur

### 1.1 sharp

**Prérequis.** sharp demande un runtime compatible Node-API v9, « e.g. Node.js >= 20.9.0 » [1]. Le champ `engines` de la version 0.35.5 indique `>=20.9.0` [2]. Node 22 convient.

**Binaires précompilés.** sharp fournit des binaires « ready-compiled » de sharp et de libvips pour « Linux x64 (glibc >= 2.28, musl >= 1.2.5, CPU with SSE4.2) » [1]. Ils couvrent « JPEG, PNG, Ultra HDR, WebP, AVIF, TIFF, GIF and SVG (input) » [1]. Ils arrivent par des dépendances optionnelles : `@img/sharp-linux-x64` (contraintes `os: linux`, `cpu: x64`, `libc: glibc`) et `@img/sharp-libvips-linux-x64` [2]. La documentation demande de s'assurer que le gestionnaire de paquets installe les dépendances optionnelles [1].

**`node:22-slim`.** L'image est une Debian 12 (bookworm) avec glibc 2.36, au-dessus du minimum de 2.28 **[vérifié]** (`ldd --version` dans `node:22-slim`, Node 22.23.3). libvips est embarquée dans `@img/sharp-libvips-linux-x64` : aucun paquet `apt` n'est nécessaire. Une libvips globale n'est utilisée que si elle est présente et assez récente [1].

**pnpm et `allowBuilds`.** Depuis pnpm 10.26, `allowBuilds` autorise (`true`) ou interdit (`false`) les scripts d'un paquet. « Packages not listed in `allowBuilds` are disallowed by default and are treated as unreviewed » [3]. Avec `strictDepBuilds` (vrai par défaut), un paquet non revu qui a des scripts de build fait échouer l'installation [3]. Or le `package.json` publié de sharp 0.35.5 n'a ni `install`, ni `preinstall`, ni `postinstall` [2]. **[vérifié]** `pnpm add sharp` avec pnpm 12.6.0 dans `node:22-slim`, avec un `allowBuilds` qui ne mentionne pas sharp : installation sans erreur ni avertissement en 0,8 s. Six paquets sont ajoutés (`sharp`, `@img/sharp-linux-x64`, `@img/sharp-libvips-linux-x64`, `@img/colour`, `detect-libc`, `semver`). sharp se charge ensuite et encode en JPEG, WebP et AVIF.

**Dockerfile actuel.** Le stage `runtime` reprend le `node_modules` du stage `build`, construit sur la même plateforme (`node:22-slim`, linux-x64, glibc). Les binaires installés au build sont donc ceux qu'il faut à l'exécution. Le réglage `supportedArchitectures` de pnpm ne servirait que pour installer les binaires d'une autre plateforme que celle qui installe, par exemple pour copier un `node_modules` d'un Mac vers Linux. Il ne compile rien : « This setting does not cross-compile native addons » [4].

**Poids.** Environ 20 Mo dans l'image : 18 Mo pour libvips, 432 Ko pour l'addon natif (`@img/sharp-linux-x64`), 936 Ko pour sharp **[vérifié]** (`du` sur le store pnpm).

**Sécurité.** sharp embarque des bibliothèques natives qui décodent des fichiers venus de l'extérieur. Trois avis de sévérité haute ont été publiés en 2026 [5] :

- libvips (`GHSA-f88m-g3jw-g9cj`), corrigé en 0.35.0 ;
- libheif (`GHSA-rgj7-g3m4-5g8c`), corrigé en 0.35.4 ;
- librsvg (`GHSA-wq5f-xc86-pv6w`), corrigé en 0.35.5. librsvg décode le SVG en entrée.

Il faut donc suivre les versions de sharp, et n'accepter que les formats utiles. La documentation recommande le niveau par défaut `failOn: 'warning'` pour les entrées non fiables [6]. `limitInputPixels` vaut 268 402 689 pixels par défaut, et peut être abaissé [6].

**Comportements à connaître.**

- Par défaut, la sortie perd toutes ses métadonnées, « which includes EXIF-based orientation » [7]. Les données EXIF (dont une éventuelle position GPS) ne sont donc pas republiées. En revanche, il faut appliquer l'orientation avant l'encodage : option `autoOrient: true` du constructeur [6], ou `.rotate()` sans argument.
- Les images HEIC (compression `hevc`, le format photo des iPhone) demandent une libvips globale compilée avec libheif, libde265 et x265 [7]. Les binaires précompilés ne les lisent donc pas.
- Sous Linux glibc, sans jemalloc, `concurrency()` vaut 1 par défaut, « to reduce memory fragmentation » [8]. Le cache de libvips occupe au plus 50 Mo, 20 fichiers et 100 éléments par défaut. `sharp.cache(false)` le désactive [8]. Au volume prévu (quelques dizaines d'envois avant la convention), ces réglages ne posent pas de problème.
- Redimensionnement : `fit: 'inside'` garde les proportions, avec des dimensions « less than or equal to both those specified ». `withoutEnlargement` évite d'agrandir une petite image [9]. Le `fit` par défaut est `cover`, qui recadre [9].

### 1.2 Mesures

**[vérifié]** sharp 0.35.5 (libvips 8.18.7, libwebp 1.6.0, aom 3.15.1) dans `node:22-slim`, sur un poste de développement (WSL2). La photo source est un fixture du dépôt sharp (`test/fixtures/2569067123_aca715a2ee_o.jpg`) : JPEG de 2725×2225 px, 810 Ko. Traitement : `autoOrient` puis `resize({ fit: 'inside', withoutEnlargement: true })` sur la largeur indiquée. Les temps varieront sur le VPS.

| Largeur max | JPEG mozjpeg q80 | WebP q80        | WebP q70        | AVIF q50 (effort 4) |
| ----------- | ---------------- | --------------- | --------------- | ------------------- |
| 800 px      | 65 Ko · 137 ms   | 54 Ko · 140 ms  | 40 Ko · 97 ms   | 30 Ko · 2,3 s       |
| 1200 px     | 130 Ko · 164 ms  | 103 Ko · 175 ms | 77 Ko · 162 ms  | 59 Ko · 4,2 s       |
| 1600 px     | 208 Ko · 245 ms  | 156 Ko · 268 ms | 113 Ko · 267 ms | 92 Ko · 7,0 s       |

Les réglages par défaut de sharp sont les suivants [7] :

- `webp()` : qualité 80, effort 4 (de 0 à 6) ;
- `avif()` : qualité 50, effort 4 (de 0 à 9), chroma en 4:4:4 ;
- `jpeg()` : qualité 80, `mozjpeg: false`.

Les qualités ne se comparent pas d'un format à l'autre : le tableau donne des ordres de grandeur, pas une équivalence visuelle. Une image synthétique (dégradés) donne des fichiers 3 à 4 fois plus petits. Seule une photo réelle est représentative.

### 1.3 Alternatives sans binaire natif

- **`@img/sharp-wasm32`** (0.35.5, 9,3 Mo) : le même sharp compilé en WebAssembly. Il sert dans les « runtime environments that provide multi-threaded Wasm via Workers ». Il n'est pris en charge ni dans un navigateur, ni dans un environnement mono-thread, et ne fait ni rendu de texte, ni sortie en tuiles [1]. Il ne sert que si les binaires natifs posent problème, ce qui n'est pas notre cas.
- **wasm-vips** (0.0.19, 13 Mo) : libvips compilée avec Emscripten, pour le navigateur et Node (17 et plus). Son README annonce « This library is still under early development » [10].
- **Jimp** (1.6.1) : « An image processing library written entirely in JavaScript ». Il gère PNG, JPEG, BMP, GIF et TIFF [11]. WebP et AVIF passent par les plugins `@jimp/wasm-webp` et `@jimp/wasm-avif`, qui reprennent les codecs de jSquash [2]. **[vérifié]** Sur la même photo : JPEG q80 en 800 px, 93 Ko en 1,2 s, contre 65 Ko en 137 ms pour sharp avec mozjpeg. L'encodage WebP échoue sous Node 22 (`TypeError: fetch failed … not implemented... yet...`) : le codec charge son fichier WASM par `fetch` sur une URL `file:`.
- **jSquash** (`@jsquash/webp`, `@jsquash/avif`, `@jsquash/resize`) : codecs de Squoosh repackagés. « There is limited support for Node.js environments ». Le support de Node est expérimental : il demande des étapes supplémentaires pour inclure les fichiers WASM, et « the WASM modules are not optimized for speed with Node.js » [12].
- **`@squoosh/lib`** : abandonné. Sa dernière publication date de janvier 2023, et il annonce Node 12, 14 ou 16 [2].

## 2. Formats de sortie et Safari iOS

| Format | Safari iOS                                                                              | Safari macOS                                                   | Source |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| WebP   | Oui dès 14.0                                                                            | Oui dès 16.0. De 14.0 à 15.6, il faut macOS 11 Big Sur ou plus | [13]   |
| AVIF   | 16.0 à 16.3 : images fixes seulement, sans _noise synthesis_. Oui sans réserve dès 16.4 | 16.1 à 16.3 : partiel, macOS 13 Ventura ou plus. Oui dès 16.4  | [14]   |
| JPEG   | Universel                                                                               | Universel                                                      | —      |

- WebKit annonçait pour Safari 14 : « This release of WebKit in Safari 14 adds support for the WebP open-source image format » [15].
- Pour Safari 16.0 : « Safari for iOS 16 includes support for still images compressed using the AVIF format » [16].
- Sur la cible du front office (iOS 16.4 et plus), WebP et AVIF sont donc sûrs tous les deux. Une image de scénario est fixe, ce qui écarte les réserves d'iOS 16.0 à 16.3. Le back office vise un ordinateur, où les navigateurs récents lisent aussi les deux formats.
- Un JPEG de repli (`<picture>`, ou négociation par l'en-tête `Accept`) n'est pas nécessaire pour cette cible. Il garderait son intérêt pour des appareils plus anciens que la cible.
- Pour situer la taille d'affichage : une image en pleine largeur sur un écran de 390 px CSS en densité 3 demande environ 1170 px réels. Le format d'affichage de la fiche d'une partie (§5.3 du PRD) n'est pas encore défini.

## 3. Stockage

Contexte :

- Le ticket #2 a tranché : « dans un premier temps, chaque convention repart d'une base vide ». Une base ne contient qu'une convention, et rien n'est repris d'une convention à la suivante. La remise à zéro de la base est hors de la carte #1 [17]. Le §8 du PRD, sur `main`, mentionne encore ce point ouvert : sa mise à jour reste à faire.
- `docker-compose.prod.yml` ne déclare qu'un volume, `db_data`, pour PostgreSQL. Le dépôt ne décrit encore aucune procédure de sauvegarde.
- Volume attendu : quelques dizaines de scénarios à ~100 Ko, soit quelques Mo par convention.

### 3.1 PostgreSQL (`bytea`)

- Prisma : le type `Bytes` correspond à `bytea` en PostgreSQL (`@db.ByteA`). Le client le représente par un `Uint8Array` depuis Prisma 6 (un `Buffer` avant) [18].
- `bytea` occupe « 1 or 4 bytes plus the actual binary string » [19]. Une valeur TOAST est limitée à 1 Go [20], très au-dessus du besoin.
- TOAST se déclenche quand une ligne dépasse ~2 Ko. La stratégie par défaut, `EXTENDED`, tente d'abord de compresser, puis stocke hors ligne [20]. Une image déjà compressée (WebP, AVIF) ne gagne rien à cette compression. `EXTERNAL` stocke hors ligne sans compresser [20]. Prisma ne sait pas exprimer ce réglage dans son schéma : il faudrait un `ALTER TABLE … SET STORAGE EXTERNAL` dans le SQL d'une migration. À quelques Mo, c'est une optimisation facultative.
- Prisma charge une colonne `Bytes` en mémoire à chaque lecture qui la sélectionne. Une table séparée, ou un `select` explicite, évite de charger les images en lisant la liste des scénarios.
- **Sauvegarde** : un `pg_dump` couvre les scénarios et leurs images d'un coup, et la restauration les garde cohérents.
- **Remise à zéro** : vider ou recréer la base supprime aussi les images. Il ne reste aucun fichier orphelin.
- L'enregistrement d'un scénario et celui de son image peuvent tenir dans une même transaction.
- Chaque requête d'image interroge la base. Avec le cache HTTP et celui du service worker, et ~80 personnes au plus (PRD §6), la charge reste faible. C'est une inférence, non mesurée ici.

### 3.2 Volume Docker

- Un volume survit à la suppression du conteneur. Sa suppression est une étape à part (`docker volume rm`) [21].
- La sauvegarde documentée passe par un conteneur temporaire et `tar` (`docker run --rm --volumes-from … tar cvf /backup/backup.tar …`) [21]. C'est une deuxième procédure, en plus du `pg_dump`.
- **[vérifié]** L'image tourne en `USER node`. Un volume neuf monté sur un dossier qui existe dans l'image reprend son contenu, son propriétaire et ses droits (`node:node 755`). Monté sur un dossier absent de l'image, il appartient à `root:root` (`755`), et `node` ne peut pas y écrire. Le Dockerfile devrait donc créer le dossier et le donner à `node` avant `USER node`. La documentation dit seulement que le contenu est copié [21].
- **Remise à zéro** : il faut purger la base et le volume ensemble, sinon des fichiers orphelins restent. Pour la même raison, rien ne rend atomiques l'écriture d'un fichier et celle de la ligne qui le référence.
- Le développement (`pnpm dev`), les tests e2e de l'API et Playwright auraient besoin d'un dossier inscriptible et de son nettoyage.
- Le service est simple : servir des fichiers statiques, avec `ETag` et `Last-Modified`.

### 3.3 Stockage objet (compatible S3)

- Il ajoute un service externe ou un conteneur à exploiter, des secrets, un SDK, et un appel réseau depuis le VPS.
- Sauvegarde et purge dépendent du service retenu. La remise à zéro devient une troisième opération, après la base et le déploiement.
- Si les images sont servies directement depuis le stockage objet, leurs URL sont d'une autre origine. Une `<img>` d'une autre origine, sans CORS, donne une réponse opaque. Par défaut, un `dataGroup` en `performance` ne met pas en cache les réponses opaques (`cacheOpaqueResponses: false`). En `freshness`, il les met en cache [22].
- Pour quelques Mo par convention, sur un seul VPS, ce dispositif dépasse le besoin. C'est une appréciation, à confirmer au ticket #15.

### 3.4 Comparaison

| Critère                    | `bytea`                                         | Volume Docker                                                             | Stockage objet                                        |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| Sauvegarde                 | `pg_dump` seul                                  | `pg_dump` + `tar` du volume                                               | `pg_dump` + celle du service                          |
| Remise à zéro              | Avec la base                                    | Base + volume                                                             | Base + bucket                                         |
| Cohérence scénario/image   | Transactionnelle                                | Fichiers orphelins possibles                                              | Objets orphelins possibles                            |
| Changements de déploiement | Aucun                                           | Volume dans `docker-compose.prod.yml`, `mkdir`/`chown` dans le Dockerfile | Service, secrets, SDK                                 |
| Service HTTP               | Controller (lecture en base)                    | Fichiers statiques                                                        | Controller (proxy) ou URL directe d'une autre origine |
| Charge                     | Une requête en base par image non mise en cache | Lecture disque                                                            | Appel réseau ou trafic direct                         |

## 4. Envoi multipart dans NestJS 12.2

- `@nestjs/platform-express` 12.2.0 dépend directement de `multer` 2.4.0 et d'`express` 5.3.0 (son `package.json`). NestJS documente sa prise en charge des fichiers comme « a built-in module based on the multer middleware package for Express » [23]. Depuis NestJS 12.1, l'adaptateur Fastify sait aussi recevoir des fichiers avec la même API, via `@fastify/multipart` [23]. Ce n'est pas notre adaptateur.
- multer 2.4.0 ne publie pas ses types. Le type `Express.Multer.File` vient de `@types/multer` (2.3.0), à ajouter en dépendance de développement [23].
- `FileInterceptor('<champ>')` et `@UploadedFile()`. Par défaut, multer garde le fichier en mémoire (`memoryStorage()`), exposé en `Buffer` sous `file.buffer` [23]. C'est ce qu'il faut pour le passer à sharp.
- **Taille** : « Multer does not limit the size of uploaded files by default. When you keep files in memory, always set `limits.fileSize` » [23]. Les limites de multer valent `Infinity` par défaut, sauf `fieldSize` (1 Mo) et `headerPairs` (2000). Son README recommande de fixer au moins `fileSize`, `files` et `fields` contre le déni de service [24]. Dans NestJS 12.2.0, une erreur `LIMIT_FILE_SIZE` devient une `PayloadTooLargeException` (413). Les autres erreurs de limite deviennent une `BadRequestException` (400) (`multer/multer/multer.utils.js`, fonction `transformException`).
- **Validation** : `ParseFilePipe` exécute des validateurs. Il renvoie 400 par défaut, et `errorHttpStatusCode` ou `exceptionFactory` permettent de changer la réponse. `MaxFileSizeValidator` contrôle la taille en octets [23]. Un fichier est obligatoire par défaut (`fileIsRequired`) [23].
- **Type** : dans 12.2.0, `FileTypeValidator` détecte le type par les magic numbers du contenu, avec `fileTypeFromBuffer` du paquet `file-type` (22.1.1, dépendance de `@nestjs/common`). Il ne se fie pas au type déclaré par le navigateur. Trois options modifient ce comportement (code source de `pipes/file/file-type.validator.js`) :
  - `skipMagicNumbersValidation` compare seulement le type déclaré ;
  - `fallbackToMimetype` se rabat sur ce type quand la détection échoue ;
  - `overrideMimeType` remplace `file.mimetype` par le type détecté.

  Sans `file.buffer` et sans ces options, la validation échoue. `fileType` accepte une chaîne ou une expression régulière.

- **Vérification finale** : décoder avec sharp, puis vérifier `metadata().format` et les dimensions, contrôle mieux le contenu qu'un en-tête. Le SVG (texte, décodé par librsvg, cf. l'avis de 2026 [5]) peut être écarté en ne retenant que les formats matriciels utiles (JPEG, PNG, WebP, éventuellement AVIF). C'est une recommandation d'usage, pas une exigence documentée.
- **Côté back office** : l'envoi passe par un `FormData`. Selon l'ADR 0004 (branche `descripteurs-endpoints`), un endpoint se déclare dans `contract` par `endpoint<Dto>(méthode, chemin)`, et `apiUrl` ne gère pas encore les paramètres de chemin. Une image n'est pas un DTO JSON, et son URL doit figurer dans un `src` : le descripteur et `apiResource()` devront prendre en compte ce cas.
- **Organisation** (ADR 0002) : `domain` et `application` restent sans dépendance de framework. sharp vit donc dans `apps/api`, derrière un port de l'application si une commande doit déclencher le traitement.

## 5. Service, en-têtes de cache et service worker

### 5.1 Renvoyer l'image depuis NestJS

- **Piège** : dans `ExpressAdapter.reply` (12.2.0), un corps qui n'est ni `null`, ni un `StreamableFile`, mais un objet, part en `response.json(body)`. Un `Buffer` renvoyé tel quel par un handler serait donc sérialisé en JSON.
- `StreamableFile` accepte un `Readable` ou un `Uint8Array`. Son `Content-Type` vaut `application/octet-stream` par défaut. Ses options `type`, `disposition` et `length` le règlent, et `length` vaut la taille d'un `Uint8Array` par défaut [25]. L'adaptateur ne pose que `Content-Type`, `Content-Disposition` et `Content-Length` (`applyStreamHeaders`) : ni `ETag`, ni réponse 304. Les en-têtes de cache se posent avec `@Header()` ou `@Res({ passthrough: true })` [25].
- Avec `@Res()` et `res.send(buffer)`, Express 5.3.0 calcule un `ETag` (réglage `etag` à `'weak'` par défaut) et répond 304 quand la requête est encore fraîche (`req.fresh`) (`lib/response.js`, `lib/application.js`).
- Caddy (`histoires-de-chimeres.caddy`) pose `X-Content-Type-Options: nosniff` : le `Content-Type` renvoyé doit être exact (`image/webp`, `image/avif`…). `encode gzip` ne recompresse pas les images : la liste par défaut ne contient, en images, que `image/svg+xml` et les icônes, et ne s'applique qu'au-delà de 512 octets [26].

### 5.2 En-têtes de cache

Deux modèles, d'après le guide MDN [27] :

- **URL qui change avec l'image** (empreinte ou version dans l'URL, fournie par le DTO du programme) : « Content that never changes should be given a long `max-age` by using cache busting ». La directive est `Cache-Control: max-age=31536000, immutable`, et `immutable` évite toute revalidation. Quand un MJ change l'image, le programme renvoie une nouvelle URL.
- **URL fixe** : `Cache-Control: no-cache` avec un `ETag`. `no-cache` « does not prevent the storing of responses but instead prevents the reuse of responses without revalidation ». Le client renvoie l'`ETag` dans `If-None-Match`, et reçoit `304 Not Modified` si rien n'a changé.
- `public` n'est utile que si la requête porte un en-tête `Authorization`. « It is not required otherwise » [27].

### 5.3 Service worker Angular

**État actuel.** `apps/front-office/ngsw-config.json` a un groupe `assets` (`installMode: lazy`, `updateMode: prefetch`), avec `resources.files: ["/**/*.(svg|…|webp|avif|…)"]`. Or `files` ne s'applique qu'aux fichiers du build. Le générateur les liste et en calcule le hash au build (`processAssetGroups` dans `@angular/service-worker/fesm2022/config.mjs`). Les images servies par `/api` à l'exécution ne sont donc couvertes par aucun groupe aujourd'hui. `navigationUrls` exclut `/api/**`, mais cela ne concerne que les navigations, pas les images.

**Ordre de traitement.** Le worker essaie d'abord les `assetGroups`, puis les `dataGroups`, dans l'ordre du fichier. Le premier groupe qui répond gagne (`handleFetch` dans `ngsw-worker.js`, 22.2.3), ce que confirme la documentation pour chaque type de groupe [22].

**`assetGroup` avec `resources.urls`.** Ces URL « are matched at runtime ». « They are not fetched directly and do not have content hashes, but they are cached according to their HTTP headers » [22]. Le code de 22.2.3 montre la conduite : une ressource sans hash déjà en cache est servie depuis le cache, et `needToRevalidate` planifie une revalidation en tâche de fond. Cette revalidation a lieu si `max-age` est dépassé, si `Expires` est passé, ou s'il n'y a aucun de ces en-têtes. Un groupe d'assets n'a pas de limite de taille. Son cache porte le hash du manifeste (`${manifestHash}:assets`) : chaque version déployée de l'application a le sien. À une mise à jour, seul un groupe `prefetch` y recopie les ressources sans hash déjà en cache qui correspondent encore à ses motifs (`PrefetchAssetGroup.initializeFully`). Un groupe `lazy` ne reprend que les fichiers du build, et les images de l'API devront être téléchargées de nouveau.

**`dataGroup`.** Les données « are not versioned along with the application » [22]. Leur cache est nommé par la `version` du groupe (`${config.version}:data`), et non par le hash du manifeste : il survit aux déploiements. Ses réglages [22] :

- `maxSize` : nombre maximal d'entrées ;
- `maxAge` : durée de validité en cache ;
- `timeout` et `refreshAhead` ;
- `version` : change pour invalider le groupe ;
- `strategy` : `performance` (par défaut) sert d'abord le cache, en tolérant une donnée périmée dans la limite de `maxAge`. `freshness` passe d'abord par le réseau, et ne se rabat sur le cache qu'après `timeout`.

En 4G faible, `freshness` fait attendre jusqu'au `timeout` avant de servir le cache. C'est une inférence tirée de la définition.

**Ce qui est mis en cache.** Les deux types de groupes ne mettent en cache que les requêtes passées par le service worker, donc les images déjà affichées (ou demandées). Pour qu'un programme consulté hors ligne montre toutes ses images, il faut l'une de ces options :

- l'application demande les images du programme quand le réseau est là. Le service worker les met alors en cache ;
- une image absente du cache est remplacée par l'illustration par défaut de PR-7.

**Illustration par défaut.** C'est un fichier du build (`public/`). Dans le groupe `assets` actuel (`lazy`), elle n'est en cache qu'après son premier affichage. Dans le groupe `app` (`prefetch`), elle serait téléchargée dès l'installation du service worker [22].

**Le programme lui-même.** Le JSON du programme, servi par l'API, relève lui aussi d'un `dataGroup` pour être consultable hors ligne. Sa stratégie et celle des images gagneront à être choisies ensemble.

### 5.4 Stockage du navigateur (Safari)

- Depuis Safari 17 (iOS 17), une origine peut occuper jusqu'à 60 % du disque dans un navigateur, et 15 % dans une autre app. Le total va jusqu'à 80 % (navigateur) ou 20 % (autre app). L'éviction se fait par origine, la moins récemment utilisée d'abord. Elle compte le Cache API et les service workers [28].
- Une web app ajoutée à l'écran d'accueil a les mêmes quotas, et WebKit accorde `navigator.storage.persist()` selon des heuristiques, comme le fait d'être ouverte depuis l'écran d'accueil [28].
- Depuis 2020, Safari efface tout le stockage écrit par script, enregistrements et cache des service workers compris, « after seven days of Safari use without user interaction on the site » [29]. Les web apps de l'écran d'accueil ont leur propre compteur, remis à zéro par leur usage. WebKit dit ne pas s'attendre à ce que leurs données soient effacées [29].
- Avec quelques Mo d'images, les quotas ne posent pas de problème. Le délai de 7 jours concerne un participant qui ouvrirait le programme dans Safari, sans ajout à l'écran d'accueil, plus d'une semaine avant la convention. Le PRD encourage déjà l'ajout à l'écran d'accueil pour le push.

## 6. Options et compromis

Rien n'est tranché ici. La décision revient au ticket #15.

**Bibliothèque.**

- _sharp natif_ : rapide, tous les formats utiles, rien à ajouter à `allowBuilds` ni à `apt`. En contrepartie : ~20 Mo dans l'image, des CVE de bibliothèques natives à suivre, pas de HEIC.
- _`@img/sharp-wasm32`_ : même API, sans binaire natif. Ne vaut que si le natif pose problème.
- _Jimp ou jSquash_ : pur JavaScript ou WASM, mais nettement plus lents, et WebP ou AVIF difficiles à faire tourner sous Node 22.

**Format.**

- _WebP_ : ~100 Ko en 1200 px (q80) sur la photo de test, encodage en ~0,2 s, pris en charge dès iOS 14.
- _AVIF_ : 40 à 45 % plus léger que WebP à réglages par défaut, mais 16 à 26 fois plus lent à encoder (plusieurs secondes). L'`effort` est réglable (4 par défaut, de 0 à 9). Pris en charge sans réserve dès iOS 16.4, ce qui correspond pile à la cible.
- _JPEG mozjpeg_ : universel, 20 à 35 % plus lourd que WebP q80.
- _Plusieurs formats ou plusieurs tailles_ : un meilleur ajustement à chaque écran, contre plus de stockage, de code et d'entrées en cache.

**Taille et qualité.** Il faut choisir la largeur maximale (800, 1200, 1600 px…) et la qualité qui tiennent dans « environ 100 Ko » pour le format retenu. Faut-il aussi une vignette pour la liste du programme, distincte de l'image de la fiche ?

**Stockage.**

- _`bytea`_ : une seule sauvegarde, une seule remise à zéro, la cohérence transactionnelle. Une lecture en base par image non mise en cache.
- _Volume Docker_ : des fichiers statiques simples à servir, mais deux sauvegardes, deux purges et des orphelins possibles, et des changements dans le Dockerfile et le compose.
- _Stockage objet_ : surdimensionné pour quelques Mo sur un seul VPS, et une autre origine qui complique le service worker.

**Ce qui est conservé.** Garder l'original envoyé, en plus de la version réduite, permettrait de régénérer les images avec d'autres réglages. Cela multiplie le volume stocké et repose la question de l'EXIF. Ne garder que la version réduite est le plus simple.

**URL et cache HTTP.**

- _URL qui change avec l'image_ + `max-age=31536000, immutable` : aucune revalidation, ni HTTP ni par le service worker. Le DTO du programme doit porter l'URL ou son empreinte.
- _URL fixe_ + `no-cache` + `ETag` : une revalidation à chaque affichage (304 léger), servie depuis le cache hors ligne. En revanche, `StreamableFile` ne pose pas d'`ETag` : il faut `res.send()` ou un `ETag` calculé.

**Service worker.**

- _`assetGroup` avec `resources.urls`_ : servi depuis le cache, revalidé selon `Cache-Control`, sans limite de taille. Le cache n'est gardé d'une version à l'autre de l'application qu'en `installMode: prefetch`. En `lazy`, chaque déploiement le vide.
- _`dataGroup` en `performance`_ : servi depuis le cache jusqu'à `maxAge`, avec un nombre d'entrées borné par `maxSize`, et invalidable par `version`.
- _`dataGroup` en `freshness`_ : le réseau d'abord, ce qui fait attendre le `timeout` en 4G faible.
- Dans tous les cas, il faut soit demander les images à l'avance, soit afficher l'illustration par défaut quand une image manque hors ligne. L'illustration par défaut peut passer dans le groupe `prefetch`.

**Envoi.** Il faut choisir la taille maximale acceptée à l'envoi, avant redimensionnement (par exemple quelques Mo), et les formats acceptés en entrée (JPEG, PNG, WebP ; AVIF ? jamais SVG ?). Il faut aussi choisir le statut d'erreur pour un mauvais type (400 par défaut, ou 422).

## Sources

1. sharp, _Installation_ : https://sharp.pixelplumbing.com/install
2. Registre npm : `npm view sharp@0.35.5`, `@img/sharp-linux-x64@0.35.5`, `@img/sharp-libvips-linux-x64@1.3.4`, `@img/sharp-wasm32`, `wasm-vips`, `jimp`, `@jimp/wasm-webp`, `@jimp/wasm-avif`, `@squoosh/lib`, `@types/multer` (champs `scripts`, `optionalDependencies`, `os`, `cpu`, `libc`, `engines`, `dist.unpackedSize`, `time`)
3. pnpm, _Build Settings_ (`allowBuilds`, `strictDepBuilds`) : https://pnpm.io/settings/build
4. pnpm, _Dependency Resolution_ (`supportedArchitectures`) : https://pnpm.io/settings/dependency-resolution
5. Avis de sécurité de sharp : https://github.com/lovell/sharp/security/advisories (`gh api repos/lovell/sharp/security-advisories`)
6. sharp, _Constructor_ (`limitInputPixels`, `failOn`, `autoOrient`) : https://sharp.pixelplumbing.com/api-constructor
7. sharp, _Output options_ (`webp`, `avif`, `jpeg`, `heif`, métadonnées) : https://sharp.pixelplumbing.com/api-output
8. sharp, _Utilities_ (`cache`, `concurrency`) : https://sharp.pixelplumbing.com/api-utility
9. sharp, _Resizing images_ (`fit`, `withoutEnlargement`) : https://sharp.pixelplumbing.com/api-resize
10. wasm-vips, README : https://github.com/kleisauke/wasm-vips
11. Jimp, documentation : https://jimp-dev.github.io/jimp/
12. jSquash, README : https://github.com/jamsinclair/jSquash
13. caniuse, _WebP image format_ (données `features-json/webp.json`) : https://caniuse.com/webp
14. caniuse, _AVIF image format_ (données `features-json/avif.json`) : https://caniuse.com/avif
15. WebKit, _New WebKit Features in Safari 14_ : https://webkit.org/blog/11340/new-webkit-features-in-safari-14/
16. WebKit, _WebKit Features in Safari 16.0_ : https://webkit.org/blog/13152/webkit-features-in-safari-16-0/
17. Ticket #2, _Une convention unique ou des éditions successives ?_, commentaire de résolution : https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/2
18. Prisma, _Prisma schema reference_ (`Bytes`) : https://www.prisma.io/docs/orm/reference/prisma-schema-reference
19. PostgreSQL 17, _Binary Data Types_ : https://www.postgresql.org/docs/17/datatype-binary.html
20. PostgreSQL 17, _TOAST_ : https://www.postgresql.org/docs/17/storage-toast.html
21. Docker, _Volumes_ : https://docs.docker.com/engine/storage/volumes/
22. Angular, _Service worker configuration_ : https://angular.dev/ecosystem/service-workers/config ; code source de `@angular/service-worker` 22.2.3 (`ngsw-worker.js`, `fesm2022/config.mjs`)
23. NestJS, _File upload_ : https://docs.nestjs.com/techniques/file-upload ; code source de `@nestjs/common` 12.2.0 (`pipes/file/file-type.validator.js`) et de `@nestjs/platform-express` 12.2.0 (`multer/multer/multer.utils.js`, `adapters/express-adapter.js`)
24. multer 2.4.0, README (sections _limits_ et _Security_) : https://github.com/expressjs/multer
25. NestJS, _Streaming files_ : https://docs.nestjs.com/techniques/streaming-files
26. Caddy, directive `encode` : https://caddyserver.com/docs/caddyfile/directives/encode
27. MDN, _HTTP caching_ : https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching
28. WebKit, _Updates to Storage Policy_ : https://webkit.org/blog/14403/updates-to-storage-policy/
29. WebKit, _Full Third-Party Cookie Blocking and More_ : https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
