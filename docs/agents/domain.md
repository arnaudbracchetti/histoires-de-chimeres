# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo: the pnpm packages (`domain`, `application`, `contract`) and apps are DDD layers of one bounded context, not separate contexts.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root: the ubiquitous language, in French with the English code term (Créneau · `TimeSlot`). Terms listed under _Avoid_ are excluded.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.
- **`docs/prd.md`**: the requirements. Cite requirement IDs (ID-1, PR-5, TI-4…) in issues and tests. §8 lists open points: raise them with the user instead of deciding.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── GLOSSARY.md
├── docs/
│   ├── prd.md
│   └── adr/
│       ├── 0001-identification-par-pseudo-et-code-de-recuperation.md
│       └── 0002-domaine-et-application-en-packages-sans-framework.md
├── packages/   (domain, application, contract)
└── apps/       (api, front-office, back-office)
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0002 (domain and application as framework-free packages), but worth reopening because…_
