# Déployer Histoires de chimères en production

Production sur `hdc.nekbet.fr`, sur le VPS d'Agilometre. Le compte `deploy`, le Caddy « edge »
(`/opt/edge`) et le réseau Docker `edge_net` existent déjà : ce document ne les recrée pas.

| Élément | Valeur |
|---|---|
| Domaine | `hdc.nekbet.fr` |
| Dossier sur le serveur | `/opt/hdc`, propriétaire `deploy` |
| Image | `ghcr.io/arnaudbracchetti/histoires-de-chimeres-app:vX.Y.Z` (publique, pas de `latest`) |
| Fichiers copiés | `docker-compose.prod.yml`, `deploy-hdc.sh`, `.env` (dans `/opt/hdc`), `histoires-de-chimeres.caddy` (dans `/opt/edge/sites/`) |
| Journal des déploiements | `/opt/hdc/deploiements.log` |
| Dumps locaux | `/opt/hdc/sauvegardes/`, effacés au bout de 30 jours |
| Dumps de nuit | bucket B2 privé, masqués au bout de 15 jours, effacés le lendemain |
| Secrets | `/opt/hdc/.env` (`chmod 600`) et fiche Dashlane « hdc production » |

Le détail de chaque option du script est dans l'en-tête de `deploy-hdc.sh`.

**Serveur de test sur la même machine.** `test2.nekbet.fr` est une instance à part, qui ne
partage rien avec la production : dossier `/opt/hdc-test2`, projet
Compose `histoires-de-chimeres-test2` (`docker-compose.test2.yml`), donc ses propres conteneurs,
réseau et volume, image locale `histoires-de-chimeres-test2-app`, alias `chimeres-test2-app`, site
`/opt/edge/sites/histoires-de-chimeres-test2.caddy`. Elle se déploie par `scripts/deploy-test.sh`.
`docker-compose.prod.yml` porte le nom de projet `histoires-de-chimeres-prod` : lancé depuis un
autre dossier que `/opt/hdc`, il agit sur les conteneurs et le volume de la production.

## 1. Premier déploiement

Une seule fois, dans cet ordre. `<ip>` est l'adresse du VPS.

### 1.1 DNS

Un enregistrement A `hdc.nekbet.fr` vers `<ip>`. Pas d'AAAA. Attendre qu'il réponde :

```bash
dig +short hdc.nekbet.fr     # attendu : <ip>
```

### 1.2 Dossier

`deploy` n'a pas `sudo` (il est seulement dans le groupe `docker`). Créer le dossier avec le compte
d'administration du serveur (`<admin>`) :

```bash
ssh <admin>@<ip> "sudo mkdir -p /opt/hdc && sudo chown deploy:deploy /opt/hdc"
```

Tout le reste se fait avec `deploy`.

### 1.3 Copies

Depuis la racine du dépôt, sur le poste :

```bash
scp docker-compose.prod.yml deploy-hdc.sh .env.prod.example deploy@<ip>:/opt/hdc/
ssh deploy@<ip> "chmod +x /opt/hdc/deploy-hdc.sh"

sed "s/__PUBLIC_DOMAIN__/hdc.nekbet.fr/" histoires-de-chimeres.caddy \
  | ssh deploy@<ip> "cat > /opt/edge/sites/histoires-de-chimeres.caddy"
```

### 1.4 `.env`

Les clés VAPID se génèrent **une seule fois**, sur le poste :

```bash
pnpm dlx web-push generate-vapid-keys
```

Puis sur le serveur :

```bash
cd /opt/hdc
mv .env.prod.example .env
chmod 600 .env
openssl rand -hex 32          # mot de passe Postgres : rien à échapper dans DATABASE_URL
nano .env
```

À remplir :

- `IMAGE_TAG=v0.1.0` ;
- `POSTGRES_PASSWORD` : la valeur d'`openssl rand -hex 32` ;
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` : les clés générées plus haut. **Ne jamais les
  régénérer** : une nouvelle clé oblige chaque téléphone à se réabonner aux notifications ;
- `VAPID_SUBJECT=https://hdc.nekbet.fr` ;
- `ORGANIZER_PSEUDO` : le pseudo habituel de l'Organisateur. `ORGANIZER_PASSWORD` : 20 caractères
  ou plus, tirés par Dashlane, à changer dans le back office (« Mon compte ») après la première
  connexion ;
- `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET` : laissés vides pour l'instant (§1.10).

Porte de secours (ADR 0016) : pour reprendre la main, mettre un nouveau mot de passe dans `.env`,
puis `docker compose -f docker-compose.prod.yml up -d` dans `/opt/hdc`.

### 1.5 Dashlane

Une fiche « hdc production » : le contenu entier de `.env`. Elle recevra plus tard l'identifiant
et le secret de la clé B2, et le nom du bucket (§1.10). Les dumps ne sont pas chiffrés : pas de
clé de chiffrement à garder.

### 1.6 Premier tag

Sur le poste, main à jour et Playwright passé (`pnpm test:e2e`) :

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Attendre que les deux jobs du workflow `CI` réussissent sur GitHub (`verify`, puis `image`).

### 1.7 Paquet ghcr public

Un paquet nouveau est privé. Dans GitHub, paramètres du paquet `histoires-de-chimeres-app`,
passer la visibilité en public. Une seule fois : le serveur tire ensuite l'image sans jeton ni
`docker login`.

### 1.8 Caddy, puis le script

**`caddy reload` d'abord.** Sans Caddy, le contrôle HTTPS du script échoue et le journal reste
vide : le déploiement suivant se croirait le premier, sans retour automatique.

```bash
docker compose -f /opt/edge/docker-compose.yml exec caddy \
  caddy reload --config /etc/caddy/Caddyfile
```

Caddy prend alors le certificat. Le site répond 502 tant que l'app ne tourne pas : c'est normal.

```bash
/opt/hdc/deploy-hdc.sh v0.1.0
```

Attendu : `OK : v0.1.0 répond sur https://hdc.nekbet.fr`, et une ligne dans `deploiements.log`.
Au premier déploiement, le script ne tente ni retour ni restauration : en cas d'échec, il
s'arrête sur l'erreur. La corriger, puis relancer la même commande.

### 1.9 Vérifications

Sur le serveur :

```bash
cd /opt/hdc
docker compose -f docker-compose.prod.yml exec app id      # attendu : uid=1000(node), pas root
```

Depuis le poste :

```bash
nmap -Pn hdc.nekbet.fr
# attendu : seuls 80 et 443 (Caddy) et 22 (SSH) ouverts ; ni 3000 ni 5432

curl -I http://hdc.nekbet.fr
# attendu : 308 vers https://

curl -I https://hdc.nekbet.fr
# attendu : Strict-Transport-Security, X-Content-Type-Options: nosniff, X-Frame-Options: DENY,
# Referrer-Policy: strict-origin-when-cross-origin, pas d'en-tête Server

curl -vI https://hdc.nekbet.fr 2>&1 | grep -i issuer
# attendu : Let's Encrypt

curl -s https://hdc.nekbet.fr/api/health
# attendu : "version":"v0.1.0"

curl -sI https://hdc.nekbet.fr/gestion/lien-d-acces/essai | grep -i referrer
# attendu : Referrer-Policy: no-referrer (ADR 0018)
```

Dans un navigateur (prérequis : le Message d'un Organisateur, #192, est livré) :

- connexion au back office (`https://hdc.nekbet.fr/gestion/`) avec l'Organisateur de `.env`,
  puis changement du mot de passe dans « Mon compte » ;
- notification réelle : sur un iPhone (le front office ajouté à l'écran d'accueil, iOS 16.4 ou plus) et
  sur un Android, entrer le code de présence, prendre un pseudo de test, accepter les
  notifications. Depuis le back office, envoyer un Message d'un Organisateur à chaque pseudo :
  la notification doit arriver sur les deux téléphones ;
- supprimer ensuite les pseudos de test (fiche du participant, « Supprimer le pseudo », ID-10).
  Pas de remise à zéro de la base.

### 1.10 Sauvegardes

En dernier, une fois le site sain.

**Bucket B2** (interface de Backblaze) :

- un bucket privé, par exemple `hdc-sauvegardes` ;
- une règle de cycle de vie personnalisée sur tout le bucket : masquer les fichiers 15 jours
  après l'envoi, les supprimer 1 jour après.

**Clé d'application**, limitée au bucket, **sans `deleteFiles`**. L'interface ne propose que des
lots de droits (« Read and Write » comprend la suppression) : créer la clé avec l'outil `b2` :

```bash
b2 key create --bucket hdc-sauvegardes hdc-serveur listBuckets,listFiles,readFiles,writeFiles
```

`writeFiles` sert à la sauvegarde de nuit, `readFiles` au téléchargement de l'option 4, et
`listFiles` à la liste des dumps de l'option 4.

Reporter dans `/opt/hdc/.env` et dans la fiche Dashlane : `B2_KEY_ID` (le keyID de la clé, pas
l'identifiant du compte), `B2_APPLICATION_KEY` et `B2_BUCKET` (le **nom** du bucket, pas son ID : avec
un nom inconnu, rclone crée un autre bucket, si la clé le permet).

**rclone** : `sudo apt install rclone`, avec le compte d'administration (`deploy` n'a pas `sudo`). Pas de `rclone.conf` : le script lit la clé
dans `.env` et la passe à rclone par variables d'environnement.

**Cron** du compte `deploy` (`crontab -e`). La sauvegarde doit partir à 3 h 30 heure de Paris.
Vérifier le fuseau du serveur par `timedatectl` :

```bash
# serveur en Europe/Paris :
30 3 * * * /opt/hdc/deploy-hdc.sh sauvegarde-nuit >> /opt/hdc/sauvegardes.log 2>&1
# serveur en UTC : 30 2 (3 h 30 en hiver, 4 h 30 en été)
```

**Premier essai, à la main** :

```bash
/opt/hdc/deploy-hdc.sh sauvegarde-nuit
```

Attendu : `OK : chimeres-AAAA-MM-JJ.dump envoyé`. Vérifier dans l'interface de B2 que le fichier
est dans le bucket, qu'aucun autre bucket n'est apparu (signe d'une clé trop large, ou d'un ID mis
à la place du nom), avec une taille plausible (quelques Mo au plus). Noter cette taille : elle
servira de repère.

## 2. Mettre à jour

1. Sur le poste, main à jour et Playwright passé :
   ```bash
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```
2. Attendre que le workflow `CI` réussisse (`verify`, puis `image`). Si la CI échoue, aucune image
   n'est publiée et le script s'arrête sans rien toucher.
3. Sur le serveur :
   ```bash
   /opt/hdc/deploy-hdc.sh vX.Y.Z
   ```
   Le script fait un dump `avant-vX.Y.Z`, démarre la version, contrôle la version publique et
   écrit le journal. Si elle ne démarre pas, il restaure ce dump et relance la version d'avant.

Pas de `caddy reload` à une mise à jour : seulement si `histoires-de-chimeres.caddy` change.

**À signaler à la publication** (dans le message du tag, `git tag -a vX.Y.Z -m "…"`) :

- une migration `-- incompatible` : le retour arrière de cette version restaurera le dump ;
- une valeur nouvelle dans une colonne existante (une valeur d'énumération, un nouvel état) : la
  version précédente ne sait pas la lire. Au retour arrière (§3.1), répondre « o » à la question
  « vX.Y.Z écrit-il une valeur nouvelle ? ».

Règles d'écriture des migrations : `docs/Regles-ecriture-de-code.md`, « Migrations de la base ».

## 3. Revenir en arrière et restaurer

### 3.1 Revenir à la version précédente (option 2)

```bash
/opt/hdc/deploy-hdc.sh      # menu, option 2
```

Un seul cran : de N à N-1, lus dans `deploiements.log`. Par défaut, **sans restauration** : N-1
repart sur la base telle qu'elle est, et rien de ce qui a été saisi depuis le déploiement n'est
perdu (ADR 0021).

La restauration du dump `avant-vN` (toute saisie faite depuis le déploiement est alors perdue)
n'a lieu que :

- si une migration de N porte `-- incompatible` : le script le voit seul, et restaure ;
- ou si N écrit une valeur nouvelle : le script le demande, répondre « o ».

Avant de restaurer, les options 2 et 4 affichent la date du dump et demandent de taper
`RESTAURER`. Elles font d'abord un dump `avant-restauration-…` : une restauration s'annule par
l'option 4. Seul le retour automatique d'un déploiement raté restaure sans rien demander.

### 3.2 Restaurer une sauvegarde (option 4)

Pour une base abîmée (fausse manœuvre, données perdues) ou pour remonter plus loin que N-1.

- Dumps locaux : `avant-vX.Y.Z` (fait avant chaque déploiement), `manuel-…` (option 3),
  `avant-restauration-…`. Gardés 30 jours.
- Dumps de nuit de B2, choisis par leur date (`b` dans la liste). Gardés 15 jours.

Un dump `avant-vX.Y.Z` ou `avant-restauration-…-vX.Y.Z` relance aussi la version vX.Y.Z. Les
autres relancent la version en place.

### 3.3 Remonter plus loin que N-1

Le script refuse de déployer une version plus ancienne que N-1 : elle ne connaît pas les
migrations suivantes. Pour revenir à vK, restaurer le dump `avant-vK` par l'option 4 : la base
revient à son état d'avant le déploiement de vK, et le script relance vK. Tout ce qui a été saisi
depuis ce déploiement est perdu.

### 3.4 Pendant la convention

Avant une opération délicate (un tirage, une correction en masse), faire un dump à la main :
option 3, `manuel-AAAA-MM-JJ-HHMM.dump`. Il reste sur le serveur, il ne part pas sur B2.

## 4. Exercice de restauration

**Une fois, en décembre, avant l'ouverture aux MJ.** La production n'a pas encore de vraies
données : c'est le moment de vérifier qu'une sauvegarde se restaure vraiment.

1. Noter quelque chose de reconnaissable dans la base (un scénario, un pseudo de test).
2. Le lendemain de la sauvegarde de nuit, le modifier ou le supprimer.
3. `/opt/hdc/deploy-hdc.sh`, option 4, puis `b`, puis la date de la nuit d'avant la
   modification. Taper `RESTAURER`.
4. Vérifier : le script finit sur `OK : … restauré`, `/api/health` renvoie la version en place,
   la connexion au back office marche, et l'élément du point 1 est revenu tel qu'il était.
5. Supprimer ce qui a servi à l'exercice.

## 5. Vérifier les sauvegardes à la main

Aucune alerte ne prévient si la sauvegarde de nuit cesse de partir. Dans l'interface de B2,
vérifier que le fichier `chimeres-AAAA-MM-JJ.dump` de la nuit est là, avec une taille proche de
celle des jours précédents :

- quelques jours avant la convention ;
- le matin même.

Si un fichier manque : lire `/opt/hdc/sauvegardes.log` sur le serveur, puis lancer
`/opt/hdc/deploy-hdc.sh sauvegarde-nuit` à la main.

## 6. Dépannage

| Symptôme | Cause probable | Correctif |
|---|---|---|
| `image introuvable sur ghcr` | CI du tag en échec, ou paquet encore privé | Voir le workflow sur GitHub ; §1.7 |
| `https://hdc.nekbet.fr/api/health renvoie « rien »` | Caddy n'a pas relu son site, ou DNS pas encore propagé | §1.8 (`caddy reload`), `dig +short hdc.nekbet.fr` |
| `IMAGE_TAG manque dans .env` à toute commande compose | `IMAGE_TAG` absent de `.env` | L'ajouter (`IMAGE_TAG=vX.Y.Z`, la version en place) |
| L'app ne devient pas healthy | Migration en échec, base injoignable, `.env` incomplet | Les 50 dernières lignes du journal de l'app sont affichées par le script ; le message de Prisma vient avant ceux de Nest |
| `envoi sur B2 impossible` | Clé B2 fausse, ou droit manquant | Vérifier les trois variables B2 de `.env` et les droits de la clé (§1.10) |
