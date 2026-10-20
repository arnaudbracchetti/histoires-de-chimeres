---
status: accepted
---

# Code en anglais, glossaire bilingue

Le produit, sa documentation et nos échanges sont en français, mais le code est écrit en anglais : identifiants, fichiers et dossiers, packages, tables et colonnes, champs JSON et routes de l'API. Chaque terme du glossaire porte sa traduction, qui est le seul nom admis dans le code (Créneau · `TimeSlot`, Partie · `Game`, Tirage · `Draw`). Restent en français ce que voit l'utilisateur (interface, notifications, messages d'erreur, URL visibles comme `/gestion/`), les commentaires, les intitulés de tests et les messages de commit.

On a choisi l'anglais pour que les noms du code s'accordent avec ceux des frameworks et des patterns (`ConventionReader`, `ScheduleRepository`). Un mélange de français et d'anglais rendait les rôles techniques plus difficiles à lire. Le glossaire bilingue préserve le langage du métier : la traduction est fixée une fois, et ne se réinvente pas à chaque fichier.

## Considered Options

- **Identifiants du domaine en français, vocabulaire technique en anglais** : la convention initiale. Elle est fidèle au langage du métier, mais donne des noms hybrides (`LecteurConvention`, `DepotProgramme`) et des traductions implicites que chacun refait à sa façon.
