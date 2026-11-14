# Où copier les sauvegardes hors du VPS

Recherche menée pour le ticket [#185](https://github.com/arnaudbracchetti/histoires-de-chimeres/issues/185), sous-ticket de la carte #184 « déploiement en production sur hdc.nekbet.fr ». Elle prépare #186. Elle rassemble des faits et finit par une recommandation : la décision revient à l'utilisateur.

Sources consultées le 14 novembre 2026. Prix hors taxes.

## Question

Quelles options réalistes pour copier chaque jour un `pg_dump` chiffré hors du VPS OVH ? Pour chacune : coût pour quelques Mo par jour, outil côté serveur, chiffrement et place de la clé, rétention, configuration, restauration.

Contraintes de la carte #184 :

- « rien n'entre de l'extérieur » : le serveur pousse ou tire lui-même ;
- secrets dans `/opt/<app>/.env` (`chmod 600`), copie dans Dashlane, jamais avec les sauvegardes ;
- la base tourne dans le conteneur `database` (`postgres:17-alpine`), sur un réseau interne sans port publié (`docker-compose.prod.yml`).

## Volume à sauvegarder

Chaque convention repart d'une base vide. Les images de scénario sont dans la base, en WebP d'environ 85 Ko ([ADR 0007](../adr/0007-images-de-scenario-stockees-en-base.md)). Le volume reste « de quelques Mo par convention » d'après l'ADR. Ordre de grandeur, à confirmer en production : 100 scénarios avec image font environ 8,5 Mo. Trente dumps quotidiens tiennent donc sous 1 Go. À ce volume, **le coût du stockage est nul ou de quelques centimes partout** : il ne départage pas les options.

## Rappel : Agilometre

`/home/arnaud/projets/agilometre/docs/deploy-agilometre.md`, §5 « Hors périmètre » : « Aucune sauvegarde automatisée de la base Postgres n'est en place à ce stade. » Le volume Docker survit à un `down`/`up`, « mais pas à un disque de serveur qui meurt ». Agilometre tourne sur le même VPS : le mécanisme retenu ici peut couvrir ses deux bases par le même script.

## Briques communes

### Le dump

`pg_dump -Fc` produit une archive au format custom, « compressed by default », à restaurer par `pg_restore` ([PostgreSQL 17, pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)). Sur le serveur, il se lance dans le conteneur, sans ouvrir de port :

```sh
docker compose -f docker-compose.prod.yml exec -T database \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"
```

Restauration : `pg_restore --clean --if-exists --no-owner -d <base> fichier.dump` (options citées par la même page).

### Trois façons de chiffrer

| Outil | Type | Clé sur le serveur | Source |
|---|---|---|---|
| **age** | asymétrique : chiffre avec la clé publique (`age -r age1…`), déchiffre avec la clé privée (`age -d -i key.txt`) | la clé publique seulement. La clé privée reste dans Dashlane | [dépôt age](https://github.com/FiloSottile/age) |
| **restic** | symétrique : un mot de passe ouvre le dépôt | le mot de passe (`RESTIC_PASSWORD_FILE`) | [restic, préparer un dépôt](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html) |
| **rclone crypt** | symétrique : XSalsa20-Poly1305, clé dérivée du mot de passe par scrypt | le mot de passe, « in a lightly obscured form » dans `rclone.conf` | [rclone crypt](https://rclone.org/crypt/) |

Les trois gardent la clé hors du stockage distant : la règle « jamais avec les sauvegardes » est tenue dans tous les cas. La différence porte sur le serveur. Avec age, une personne qui prend le serveur ne peut pas lire les anciennes sauvegardes, ce qui compte peu puisqu'elle a déjà la base vivante. Avec restic et rclone crypt, le mot de passe est sur le serveur.

Perte de la clé : « Losing your password means that your data is irrecoverably lost » (restic). C'est vrai pour les trois. Il faut donc une copie de la clé ailleurs que dans Dashlane (papier, clé USB), sinon un compte Dashlane perdu rend toutes les sauvegardes illisibles.

### Deux façons de garder N jours

- **Par l'outil, depuis le serveur** : `restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 3 --prune` ([restic, forget](https://restic.readthedocs.io/en/stable/060_forget.html)), ou `rclone delete --min-age 30d`. Le serveur a alors le droit de supprimer : un serveur compromis peut effacer toutes les sauvegardes.
- **Par le stockage** : une règle de cycle de vie du bucket supprime les fichiers au bout de N jours. Le serveur n'a qu'un droit d'écriture. C'est la seule façon de protéger les sauvegardes d'un serveur compromis.

### Envoyer un flux sans le perdre

restic propose `backup --stdin-from-command -- pg_dump …` : « Restic uses the command exit code to determine whether the command succeeded », et aucun snapshot n'est créé si `pg_dump` échoue. Avec un simple tube `pg_dump | restic backup --stdin`, la doc prévient qu'on peut obtenir une sauvegarde vide sans erreur, et demande `set -o pipefail` ([restic, backup](https://restic.readthedocs.io/en/stable/040_backup.html)). La même précaution vaut pour `pg_dump | age | rclone`.

## Les options

### A. Backblaze B2

- **Coût** : « First 10GB storage is always free », puis 6,95 $/To/mois. Sortie gratuite jusqu'à 3 fois le volume stocké. Appels d'API classes A, B, C gratuits. Aucune durée minimale de stockage ([prix B2](https://www.backblaze.com/cloud-storage/pricing)). Pour ce volume : **0 €**.
- **Outils** : rclone (backend B2 ou S3), ou restic (backend S3 recommandé par restic plutôt que son backend B2 natif).
- **Droits** : une application key se restreint à un bucket, et à un type d'accès « Read and Write », « Read Only » ou « Write Only », avec un préfixe et une expiration optionnels ([créer une app key](https://www.backblaze.com/docs/cloud-storage-create-and-manage-app-keys)). Les capacités se choisissent une à une (`listFiles`, `writeFiles`, `deleteFiles`…) ([application keys](https://www.backblaze.com/docs/cloud-storage-application-keys)).
- **Rétention** : règle de cycle de vie par préfixe, `daysFromUploadingToHiding` puis `daysFromHidingToDeleting`, appliquée une fois par jour. Exemple de la doc : masquer à 7 jours, supprimer un jour après ([lifecycle rules](https://www.backblaze.com/docs/cloud-storage-lifecycle-rules)). Object Lock existe aussi.
- **Configuration** : compte Backblaze, bucket privé, règle de cycle de vie, app key limitée au bucket et sans `deleteFiles`, rclone et age sur le serveur.
- **Restauration** : depuis le poste, `rclone copy` (ou l'interface web) avec une clé de lecture, puis `age -d` et `pg_restore`.
- **Point fort** : hors d'OVH. Un compte OVH suspendu ou compromis ne touche pas les sauvegardes.

### B. OVHcloud Object Storage

- **Coût** : Standard One Zone ~0,0071 €/Gio/mois, Standard Multi Zone ~0,0140 €/Gio/mois, trafic entrant et sortant gratuit, requêtes gratuites. Les classes froides (Infrequent Access, Active Archive, Cold Archive) ont une durée minimale facturée de 30, 90 et 180 jours ([prix Public Cloud OVHcloud](https://www.ovhcloud.com/fr/public-cloud/prices/)). Pour 1 Go : **moins de 2 centimes par mois**, facturé à l'heure par Gio. Ne pas prendre une classe froide : une rétention de 30 jours y coûterait des frais de suppression anticipée.
- **Outils** : rclone ou restic (backend S3).
- **Rétention** : règles de cycle de vie S3, expiration en jours ([lifecycle](https://docs.ovhcloud.com/en/guides/storage-and-backup/object-storage/s3-bucket-lifecycle)). Object Lock (WORM) disponible, irréversible sur le bucket, versioning obligatoire ([Object Lock](https://docs.ovhcloud.com/en/guides/storage-and-backup/object-storage/s3-managing-object-lock)).
- **Configuration** : un projet Public Cloud dans le compte OVH, un bucket dans une autre région que le VPS, un utilisateur S3 et sa politique d'accès.
- **Restauration** : comme B2.
- **Point faible** : même fournisseur et même compte que le VPS. Un incident de compte, de facturation ou de site touche les deux.

### C. Google Drive par rclone

- **Coût** : 15 Go gratuits par compte Google, partagés avec Gmail et Photos ; 100 Go à 1,99 €/mois ([Google One](https://one.google.com/about/plans)). **0 €** si le compte a de la place.
- **Outil** : rclone, avec rclone crypt ou age.
- **Configuration** : plus lourde que les autres. Le client OAuth partagé de rclone est retiré en 2026 : « you must create and use your own client_id ». Il faut un projet Google Cloud, l'API Drive, un écran de consentement et un client « Desktop app ». En mode « Testing », « any grants will expire after a week » : il faut publier l'application. Le serveur n'ayant pas de navigateur, le jeton s'obtient sur le poste ([rclone Drive](https://rclone.org/drive/)).
- **Droits** : le scope `drive.file` limite rclone aux « files created by rclone only ». Pas de droit d'écriture sans suppression : le serveur peut effacer ce qu'il a écrit (les suppressions vont à la corbeille par défaut, `--drive-use-trash`).
- **Rétention** : par le serveur seulement (`rclone delete --min-age`). Drive n'a pas de règle de cycle de vie de ce type.
- **Point faible** : le jeton d'un compte Google personnel sur le serveur, et une configuration OAuth qui peut casser sans prévenir.

### D. Un autre serveur

**D1. Hetzner Storage Box** (le serveur pousse)

- **Coût** : BX11, 3,20 €/mois, 1 To ([Storage Box](https://www.hetzner.com/storage/storage-box/)). Le plus cher des quatre pour ce volume.
- **Outils** : SFTP, rsync par SSH, BorgBackup, restic, rclone.
- **Rétention** : par l'outil (restic `forget`). La Storage Box fait aussi des snapshots, 10 automatisés : c'est la protection contre un serveur compromis.
- **Point fort** : hors d'OVH, en Allemagne ou en Finlande. Un vrai service de sauvegarde.

**D2. Une machine chez soi qui tire** (NAS, Raspberry Pi)

Elle viendrait chercher le dump par SSH. Cela demande une connexion entrante sur le VPS, contraire au principe « rien n'entre de l'extérieur », et une machine domestique allumée et surveillée. Écartée.

## Comparaison

| | B2 | OVH Object Storage | Google Drive | Hetzner Storage Box |
|---|---|---|---|---|
| Coût pour ~1 Go | 0 € | < 0,02 €/mois | 0 € | 3,20 €/mois |
| Hors d'OVH | oui | non | oui | oui |
| Écriture sans droit de suppression | oui (app key) | oui (politique S3, non testé) | non | non (snapshots à la place) |
| Rétention par le stockage | oui | oui | non | snapshots |
| Configuration | simple | moyenne (projet Public Cloud) | lourde (OAuth) | simple |
| Compte à créer | oui | non | non | oui |

## Recommandation

**Backblaze B2, `pg_dump -Fc | age -r <clé publique>`, envoyé par rclone avec une app key sans droit de suppression, rétention par une règle de cycle de vie du bucket.**

- Gratuit sous 10 Go, et hors d'OVH : un même incident ne prend pas la base et sa sauvegarde.
- age : seule la clé publique est sur le serveur. La clé privée vit dans Dashlane, avec une seconde copie hors ligne.
- Le serveur ne peut ni lire ni effacer les sauvegardes déjà envoyées. Le bucket les supprime seul au bout de N jours (par exemple 30).
- Un fichier par jour, nommé par la date : rien à dédupliquer à ce volume, donc pas besoin de restic. restic reste le bon choix si le volume grossit.
- Le même script peut sauvegarder la base d'Agilometre, qui n'en a aucune.

Restauration, depuis le poste : télécharger le fichier, `age -d -i cle.txt chimeres-AAAA-MM-JJ.dump.age > chimeres.dump`, puis `pg_restore --clean --if-exists --no-owner -d <base> chimeres.dump`.

Repli si l'on refuse un compte de plus : OVH Object Storage Standard, dans une autre région que le VPS.

## Non vérifié

- **rclone avec une clé « Write Only »** : rclone liste la destination avant d'écrire. Il faudra peut-être ajouter `listFiles`, ou des options comme `--no-check-dest`. À tester avant de figer la clé.
- **Politique S3 d'OVH sans suppression** : l'existence de politiques d'accès est documentée, mais je n'ai pas vérifié qu'on peut y refuser la seule suppression.
- **Inscription B2** : la doc consultée ne dit pas si une carte bancaire est exigée pour le palier gratuit.
- **Paquets** : versions de `age` et `rclone` disponibles dans la distribution du VPS (non consultée).
- **Taille réelle du dump** : estimée d'après l'ADR 0007, pas mesurée.
- **Dashlane** : je n'ai pas consulté sa documentation. Stocker la clé privée age (une ligne de texte) dans une note sécurisée semble suffire, mais c'est à confirmer.
- **Alerte en cas d'échec** : aucune option ne prévient seule qu'une sauvegarde a cessé de partir. Le monitoring avancé est hors de la carte #184, mais un échec silencieux reste le risque principal. L'exercice de restauration prévu dans la carte le détecterait.
