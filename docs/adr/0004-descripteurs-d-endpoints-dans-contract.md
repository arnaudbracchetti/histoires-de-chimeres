---
status: accepted
---

# Descripteurs d'endpoints écrits à la main dans `contract`

Chaque endpoint de l'API est déclaré une seule fois, dans `packages/contract`, par un descripteur (`conventionEndpoints.read = endpoint<ConventionDto>('GET', 'convention')`). Ce descripteur relie la route aux types qu'elle échange. Le controller en tire son chemin et son type de retour, et les fronts, par `apiResource()`, l'URL et le type de la réponse. Un endpoint se déclare ainsi à un seul endroit, et une coquille de route ou de type casse la compilation au lieu de casser l'exécution. Le préfixe `/api` y vit aussi (`API_PREFIX`). Seuls les fichiers de configuration qui ne peuvent rien importer (`ngsw-config.json`, proxies, Caddy) le recopient, et les tests Playwright les couvrent.

## Considered Options

- **ts-rest, ou un contrat équivalent tiré d'une librairie** : il couvre aussi la validation et le client, mais il couple `contract` (que les deux fronts importent) à une librairie et à ses versions. C'est disproportionné pour une vingtaine d'endpoints.
- **Génération OpenAPI (`@nestjs/swagger` + codegen côté fronts)** : la source de vérité serait le controller, au prix d'une étape de génération dans le build et dans `pnpm dev`, et de décorateurs de documentation sur chaque DTO.
- **Constantes de chemin seules** : elles ne relient pas la route à son DTO, et ce lien resterait à la discipline.

## Consequences

- `contract` exporte désormais des valeurs, et plus seulement des types : l'API et les fronts le chargent à l'exécution (le Dockerfile copie déjà son `dist`).
- La méthode HTTP est écrite deux fois : dans le descripteur et dans le décorateur Nest (`@Get`).
- `Endpoint<Res, Params, Body>` porte les paramètres de chemin et le corps de requête. Le chemin les écrit en `:param` (`games/:gameId/placement`), une syntaxe que Nest lit telle quelle. `apiUrl(endpoint, params)` remplace chaque `:param` par sa valeur encodée, et exige `params` dès que `Params` n'est pas `never`. Les corps sont des types `<Action>Body` de `contract`.
- Les fronts lisent par `apiResource()` et écrivent par `apiCall(endpoint, { params, body })`, sur `HttpClient` : la méthode, l'URL, le corps et le type de la réponse viennent du descripteur.
- Les endpoints d'image (multipart, ADR 0007) ont un descripteur pour leur chemin et ses paramètres, mais pas de `Body` typé.
