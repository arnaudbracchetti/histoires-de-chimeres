---
status: accepted
---

# Domaine et application en packages sans framework

Le domaine et les cas d'usage vivent dans deux packages TypeScript du monorepo pnpm, `packages/domain` et `packages/application`, qui ne déclarent aucune dépendance de framework. pnpm ne laisse un package importer que ce que déclare son `package.json` : importer NestJS ou Prisma depuis le domaine échoue donc à la compilation, au lieu de reposer sur la discipline. L'API NestJS (`apps/api`) ne garde que le HTTP, les implémentations Prisma des ports et le câblage.

## Considered Options

- **Nx, avec des tags et la règle `enforce-module-boundaries`** : frontières vérifiées par le lint, générateurs et cache de build ; écarté pour son poids et son couplage aux versions de Nx.
- **Dossiers par couche dans `apps/api`** (`domain/`, `application/`, `infrastructure/`) : plus simple à parcourir, mais l'isolation du domaine ne tient qu'à une règle ESLint.

## Consequences

- Les packages sont compilés (`tsc -b`) avant l'API et les fronts : `pnpm build` suit l'ordre des dépendances, et `pnpm dev` compile d'abord les packages.
- Les classes du domaine et de l'application ne portent aucun décorateur : l'API les instancie par `useFactory`, et injecte les ports par des jetons.
