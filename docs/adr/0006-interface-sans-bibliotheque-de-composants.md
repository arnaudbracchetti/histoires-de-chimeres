---
status: accepted
---

# Interface sans bibliothèque de composants : CDK, Aria, CSS natif et package `design`

Les deux fronts n'utilisent aucune bibliothèque de composants. Ils s'appuient sur le CDK et sur Angular Aria, qui apportent le comportement et l'accessibilité sans style, et tout le dessin est écrit en CSS natif. L'identité de la charte (Uncial Antiqua, halo orange, paliers neutres de la déclinaison « Atelier ») ne se range pas dans le cadre d'une bibliothèque, et le front office doit rester léger sur réseau mobile : le CDK ajoute moins de 20 ko, contre plus de 60 ko pour Material ou Spartan (mesures dans `docs/research/bibliotheques-interface-angular-22.md`). Le CDK est aussi la seule brique de glisser-déposer (`@angular/cdk/drag-drop`). Aucune action ne passe seulement par le glisser-déposer : chacune a aussi un chemin par bouton et menu (motif Menu d'Aria), utilisable au clavier comme à la souris (WCAG 2.2, critère 2.5.7). Il n'y a pas de glisser-déposer au clavier. Les formulaires utilisent Signal Forms sur des contrôles natifs.

Ce que les deux fronts partagent sans framework vit dans un nouveau package, `packages/design` (`@chimeres/design`), qui ne dépend de rien : les jetons (`tokens.css`), les polices, les sprites SVG (motif gravé, icônes, emblème) et la fonction `initialOf` de l'illustration par défaut. Les fronts dépendent désormais de `contract` et de `design`. Les composants Angular qui enveloppent ce contenu (champ, illustration) sont minces et dupliqués dans chaque front, comme `api-resource.ts`.

## Considered Options

- **Angular Material** : il intègre nativement Signal Forms et fournit `mat-table`, mais pèse +66 ko. Surtout, Angular déconseille de le styliser en dehors de son API de thème : l'identité resterait dans le cadre de Material Design 3.
- **Spartan ou Tailwind** : +61 ko pour Spartan, une chaîne PostCSS, et Nx tiré par le CLI de Spartan. Les styles passent dans les gabarits. Tailwind Labs a licencié 75 % de son équipe d'ingénierie en janvier 2026.
- **PrimeNG 22** : licence commerciale avec une clé à renouveler chaque année, et l'éligibilité de l'association à la licence gratuite n'est pas établie. Une clé expirée affiche un bandeau en production.
- **Une seule application Angular à deux zones** : elle simplifierait le partage. Mais le service worker préchargerait le code du back office sur les téléphones, et la frontière de dépendances entre les deux fronts disparaîtrait.
- **Code partagé dupliqué dans chaque front** : deux copies du motif, des jetons et de la règle de l'initiale à tenir alignées.
- **Bibliothèque Angular partagée, compilée par ng-packagr** : un second outil de build pour quelques composants minces.

## Consequences

- Chaque composant d'interface s'écrit à la main : bouton, champ (libellé, aide, erreur, `aria-describedby`), tableau triable en `<table>` natif.
- Le CSS est natif, sans préprocesseur. Il est encapsulé par composant et ordonné par les couches `reset, tokens, base, components`. Les conventions d'écriture vivent dans la charte (`docs/design/`).
- Les icônes sont des SVG Lucide (licence ISC), copiés dans `design` à mesure qu'on s'en sert.
- Les PNG de la PWA sont tirés de l'emblème une fois et versionnés dans `design`.
