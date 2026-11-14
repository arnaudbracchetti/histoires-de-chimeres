#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Exploitation d'Histoires de chimères sur le serveur de production (hdc.nekbet.fr).
# Copié à la main dans le dossier du compte deploy. Modèle : deploy-agilometre.sh.
#
# Usage :
#   ./deploy-hdc.sh vX.Y.Z            déploie cette version
#   ./deploy-hdc.sh sauvegarde-nuit   dump envoyé sur B2 (cron)
#   ./deploy-hdc.sh                   menu
#
# Déployer :
#   1. Refuse un tag hors format vX.Y.Z, ou plus ancien que N-1 (renvoi vers la restauration).
#   2. Tire l'image : si elle manque sur ghcr, arrêt sans rien toucher.
#   3. Fait un dump de la base : sauvegardes/avant-vX.Y.Z.dump.
#   4. Met IMAGE_TAG dans .env et relance : les migrations s'appliquent au démarrage de l'app.
#   5. Attend le « healthy », puis vérifie par HTTPS que /api/health renvoie le nouveau tag.
#   6. Ajoute une ligne à deploiements.log, puis efface les images de l'app autres que N et N-1
#      et les dumps locaux de plus de 30 jours.
#
# En cas d'échec : arrêt de l'app, base recréée vide, pg_restore du dump de l'étape 3, relance
# de la version précédente. Au premier déploiement, sans version précédente : arrêt avec l'erreur.
#
# deploiements.log, une ligne par déploiement réussi : date, tag déployé, tag précédent (- s'il n'y
# en a pas), dump fait avant. La dernière ligne donne la version en place (N) et la précédente (N-1).
#
# Sauvegarde de nuit, par le cron du compte deploy, à 3 h 30 heure de Paris (heure du serveur à
# vérifier par timedatectl) :
#   30 3 * * * /opt/hdc/deploy-hdc.sh sauvegarde-nuit >> /opt/hdc/sauvegardes.log 2>&1
# pg_dump -Fc non chiffré, envoyé par rclone sur le bucket B2 sous chimeres-AAAA-MM-JJ.dump, puis
# effacé du serveur. B2_KEY_ID, B2_APPLICATION_KEY et B2_BUCKET viennent de .env : pas de rclone.conf.
# Le serveur n'efface rien sur B2 : la clé n'a pas deleteFiles, la règle de cycle de vie du bucket
# efface au bout de 15 jours. --no-check-dest évite que rclone liste le bucket avant d'envoyer.
# Non vérifié : rclone envoie-t-il avec une clé sans listFiles ? À tester à la création de la clé.
# L'option 4 a besoin de readFiles pour télécharger, et de listFiles pour afficher la liste des
# dumps de B2 (sans elle, la liste manque mais la date se tape quand même).
#
# Sauvegarder maintenant (option 3) : dump local manuel-AAAA-MM-JJ-HHMM.dump, jamais envoyé sur B2.
#
# Restaurer (option 4) : un dump local (avant-vX.Y.Z, manuel, avant-restauration) ou un dump de nuit
# de B2 par sa date. Affiche la date du dump et demande de taper RESTAURER. Fait d'abord un dump
# sauvegardes/avant-restauration-AAAA-MM-JJ-HHMM-vX.Y.Z.dump (vX.Y.Z : la version en place), puis
# restaure comme le retour automatique : arrêt de l'app, base recréée vide, pg_restore, relance,
# healthy et version contrôlés. Un dump avant-vX.Y.Z ou avant-restauration-…-vX.Y.Z relance vX.Y.Z
# (IMAGE_TAG remis à vX.Y.Z, ligne ajoutée à deploiements.log) : annuler une restauration remet
# aussi la version d'avant. Les autres dumps relancent la version en place.
#
# Ne construit rien sur le serveur et ne touche pas à Caddy. Pas d'amorçage d'Organisateur :
# ORGANIZER_PSEUDO et ORGANIZER_PASSWORD de .env s'appliquent au démarrage (ADR 0016).
# ============================================================

APP_DIR="${HDC_DIR:-/opt/hdc}"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE="$APP_DIR/.env"
LOG_FILE="$APP_DIR/deploiements.log"
DUMP_DIR="$APP_DIR/sauvegardes"
IMAGE="ghcr.io/arnaudbracchetti/histoires-de-chimeres-app"
HEALTH_TIMEOUT=120   # secondes d'attente du « healthy »
HEALTH_INTERVAL=5
DUMP_RETENTION_DAYS=30

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo ""; echo -e "${CYAN}>> $1${NC}"; }
ok()   { echo -e "${GREEN}   OK : $1${NC}"; }
err()  { echo -e "${RED}   ERREUR : $1${NC}"; }
warn() { echo -e "${YELLOW}   ATTENTION : $1${NC}"; }

# Les dumps contiennent toutes les données : lisibles par le seul compte deploy.
umask 077

cd "$APP_DIR" 2>/dev/null || { err "dossier $APP_DIR introuvable"; exit 1; }
[ -f "$ENV_FILE" ] || { err "$ENV_FILE introuvable"; exit 1; }
[ -f "$COMPOSE_FILE" ] || { err "$COMPOSE_FILE introuvable dans $APP_DIR"; exit 1; }

compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# Valeur de la variable $1 dans .env, vide si elle manque.
env_value() { grep -oP "^$1=\\K.*" "$ENV_FILE" || true; }
public_domain() { env_value PUBLIC_DOMAIN; }

# Les noms des dumps suivent l'heure de Paris, quelle que soit celle du serveur.
paris_date() { TZ=Europe/Paris date "$@"; }

# Chemin d'un nouveau dump $1-AAAA-MM-JJ-HHMM[-$2].dump, avec les secondes si ce nom est déjà
# pris : deux dumps faits dans la même minute ne s'écrasent pas.
new_dump_path() {
  local suffix="${2:+-$2}" path
  path="$DUMP_DIR/$1-$(paris_date +%F-%H%M)$suffix.dump"
  [ -e "$path" ] && path="$DUMP_DIR/$1-$(paris_date +%F-%H%M%S)$suffix.dump"
  echo "$path"
}

# Champ $1 de la dernière ligne du journal, vide s'il n'y en a pas.
last_log_field() {
  [ -f "$LOG_FILE" ] || return 0
  local value
  value="$(tail -n 1 "$LOG_FILE" | awk -v field="$1" '{ print $field }')"
  [ "$value" = "-" ] || echo "$value"
}
current_tag_from_log() { last_log_field 2; }
previous_tag_from_log() { last_log_field 3; }

# Le plus ancien des tags donnés (les vides sont ignorés).
oldest_tag() { printf '%s\n' "$@" | grep -v '^$' | sort -V | head -n 1 || true; }

# Vrai si le tag $1 est strictement plus ancien que le tag $2.
is_older() { [ "$1" != "$2" ] && [ "$(oldest_tag "$1" "$2")" = "$1" ]; }

set_image_tag() {
  if grep -q '^IMAGE_TAG=' "$ENV_FILE"; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" "$ENV_FILE"
  else
    echo "IMAGE_TAG=$1" >> "$ENV_FILE"
  fi
}

# Attend que le conteneur $1 soit « healthy ».
wait_healthy() {
  local service="$1" elapsed=0 container health
  while [ "$elapsed" -lt "$HEALTH_TIMEOUT" ]; do
    container="$(compose ps -q "$service")"
    if [ -n "$container" ]; then
      health="$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || true)"
      [ "$health" = "healthy" ] && return 0
    fi
    sleep "$HEALTH_INTERVAL"
    elapsed=$((elapsed + HEALTH_INTERVAL))
    echo "   ... $service pas encore healthy (${elapsed}s/${HEALTH_TIMEOUT}s)"
  done
  return 1
}

# Version que renvoie le site public, vide s'il ne répond pas.
public_version() {
  curl -fsS --max-time 10 "https://$(public_domain)/api/health" 2>/dev/null \
    | grep -oP '"version"\s*:\s*"\K[^"]*' || true
}

# Relance l'app sous le tag $1, attend le « healthy » et vérifie la version publique.
start_app() {
  local tag="$1" version
  set_image_tag "$tag"
  compose up -d || return 1
  if ! wait_healthy app; then
    err "l'app ne devient pas healthy en ${HEALTH_TIMEOUT}s"
    echo "----- Dernières lignes du journal de l'app -----"
    compose logs --tail=50 app || true
    echo "------------------------------------------------"
    return 1
  fi
  version="$(public_version)"
  if [ "$version" != "$tag" ]; then
    err "https://$(public_domain)/api/health renvoie « ${version:-rien} » au lieu de « $tag »"
    return 1
  fi
}

# Dump de la base dans le fichier $1 : écrit à côté, puis renommé une fois complet.
dump_database() {
  local file="$1"
  mkdir -p "$DUMP_DIR"
  compose up -d database || return 1
  wait_healthy database || return 1
  # « < /dev/null » : sinon compose exec lit l'entrée du script et mange les réponses du menu.
  # shellcheck disable=SC2016 # les variables se lisent dans le conteneur.
  if compose exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
    < /dev/null > "$file.part" && [ -s "$file.part" ]; then
    mv "$file.part" "$file"
  else
    rm -f "$file.part"
    return 1
  fi
}

# Recrée la base vide puis y restaure le dump $1. Pas de pg_restore --clean : il peut laisser des
# objets créés après le dump. L'app doit être arrêtée.
restore_database() {
  local file="$1"
  # shellcheck disable=SC2016 # les variables se lisent dans le conteneur.
  compose exec -T database sh -c \
    'dropdb -U "$POSTGRES_USER" --force "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    < /dev/null || return 1
  # shellcheck disable=SC2016 # idem.
  compose exec -T database sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' \
    < "$file"
}

# Arrête l'app, restaure le dump $1, puis relance l'app sous le tag $2 et contrôle sa version.
# Sert au retour automatique d'un déploiement comme à l'option 4.
restore_and_start() {
  local file="$1" tag="$2"
  step "Arrêt de l'app et restauration de $file"
  compose stop app || return 1
  restore_database "$file" || return 1
  ok "base restaurée"
  step "Démarrage de $tag"
  start_app "$tag"
}

# Efface les dumps locaux de plus de DUMP_RETENTION_DAYS jours.
prune_old_dumps() {
  [ -d "$DUMP_DIR" ] || return 0
  find "$DUMP_DIR" -maxdepth 1 -type f -name '*.dump' -mmin +$((DUMP_RETENTION_DAYS * 24 * 60)) \
    -print -delete | sed 's/^/   effacé : /' || warn "ménage des dumps incomplet"
}

# Prépare rclone pour le bucket B2 (clé lue dans .env) et pose B2_REMOTE.
prepare_b2_remote() {
  local key_id key bucket
  key_id="$(env_value B2_KEY_ID)"
  key="$(env_value B2_APPLICATION_KEY)"
  bucket="$(env_value B2_BUCKET)"
  if [ -z "$key_id" ] || [ -z "$key" ] || [ -z "$bucket" ]; then
    err "B2_KEY_ID, B2_APPLICATION_KEY et B2_BUCKET doivent être remplis dans $ENV_FILE"
    return 1
  fi
  command -v rclone > /dev/null || { err "rclone n'est pas installé sur le serveur"; return 1; }
  export RCLONE_B2_ACCOUNT="$key_id" RCLONE_B2_KEY="$key"
  B2_REMOTE=":b2:$bucket"
}

# Efface les images de l'app autres que $1 et $2 (jamais celle de Postgres).
remove_old_images() {
  docker images "$IMAGE" --format '{{.Tag}}' \
    | { grep -vxF -e "$1" -e "${2:-$1}" -e '<none>' || true; } \
    | sed "s|^|$IMAGE:|" | xargs -r docker rmi || warn "ménage des images incomplet"
}

# ── 1. Déployer une version ──────────────────────────────────────────
action_deploy() {
  local new_tag="${1:-}"
  if [ -z "$new_tag" ]; then
    read -rp "Version à déployer (ex. v1.2.3) : " new_tag
  fi

  if [[ ! "$new_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    err "la version doit suivre le format vX.Y.Z (reçu : « $new_tag »)"
    return 1
  fi

  local current_tag previous_tag oldest_allowed
  current_tag="$(current_tag_from_log)"
  previous_tag="$(previous_tag_from_log)"
  # Une version plus ancienne que N et N-1 tournerait sur un schéma qu'elle ne connaît pas.
  # Après un retour, N-1 peut être plus récent que N : la borne est le plus ancien des deux.
  oldest_allowed="$(oldest_tag "$current_tag" "$previous_tag")"
  if [ -n "$oldest_allowed" ] && is_older "$new_tag" "$oldest_allowed"; then
    err "$new_tag est plus ancienne que $oldest_allowed : la base a des migrations qu'elle ne connaît pas."
    err "Pour remonter aussi loin, restaurer le dump avant-$new_tag (option 4)."
    return 1
  fi

  # Redéployer N écraserait avant-vN.dump et ferait oublier N-1 au journal et au ménage.
  if [ "$new_tag" = "$current_tag" ]; then
    err "$new_tag est déjà en place."
    return 1
  fi

  step "Image $IMAGE:$new_tag"
  if ! docker pull "$IMAGE:$new_tag"; then
    err "image introuvable sur ghcr : la CI du tag $new_tag a-t-elle réussi ? Rien n'a été touché."
    return 1
  fi
  ok "image tirée"

  local dump="$DUMP_DIR/avant-$new_tag.dump"
  step "Dump de la base avant $new_tag"
  if ! dump_database "$dump"; then
    err "dump impossible : déploiement arrêté, rien n'a été touché."
    return 1
  fi
  ok "$dump ($(du -h "$dump" | cut -f1))"

  step "Démarrage de $new_tag (version en place : ${current_tag:-aucune})"
  if start_app "$new_tag"; then
    echo "$(date -Iseconds) $new_tag ${current_tag:--} $dump" >> "$LOG_FILE"
    ok "$new_tag répond sur https://$(public_domain)"
    step "Ménage des images"
    remove_old_images "$new_tag" "$current_tag"
    ok "gardées : $new_tag et ${current_tag:-aucune autre}"
    step "Ménage des dumps de plus de $DUMP_RETENTION_DAYS jours"
    prune_old_dumps
    return 0
  fi

  if [ -z "$current_tag" ]; then
    err "Premier déploiement : pas de version précédente, ni retour ni restauration."
    err "Corriger l'erreur ci-dessus, puis relancer le déploiement."
    return 1
  fi

  warn "Retour à $current_tag avec le dump fait avant $new_tag"
  if restore_and_start "$dump" "$current_tag"; then
    ok "$current_tag répond de nouveau"
    err "Le déploiement de $new_tag a échoué et a été annulé. Voir le journal ci-dessus."
    return 1
  fi
  err "CRITIQUE : le retour à $current_tag a échoué. Intervention manuelle immédiate sur le serveur."
  err "Dump d'avant le déploiement : $dump"
  return 2
}

# ── 3. Sauvegarder maintenant ────────────────────────────────────────
action_manual_backup() {
  local dump
  dump="$(new_dump_path manuel)"
  step "Dump de la base"
  if ! dump_database "$dump"; then
    err "dump impossible."
    return 1
  fi
  ok "$dump ($(du -h "$dump" | cut -f1))"
}

# ── Sauvegarde de nuit (cron) ────────────────────────────────────────
action_nightly_backup() {
  echo ""
  echo "=== Sauvegarde de nuit du $(paris_date '+%F %H:%M') ==="
  prepare_b2_remote || return 1

  local name dump
  name="chimeres-$(paris_date +%F).dump"
  dump="$DUMP_DIR/$name"
  step "Dump de la base"
  if ! dump_database "$dump"; then
    err "dump impossible : rien n'est parti sur B2."
    return 1
  fi
  ok "$dump ($(du -h "$dump" | cut -f1))"

  step "Envoi sur B2"
  if ! rclone copyto --no-check-dest "$dump" "$B2_REMOTE/$name"; then
    err "envoi sur B2 impossible. Le dump reste sur le serveur : $dump"
    return 1
  fi
  rm -f "$dump"
  ok "$name envoyé"

  step "Ménage des dumps de plus de $DUMP_RETENTION_DAYS jours"
  prune_old_dumps
}

# ── 4. Restaurer une sauvegarde ──────────────────────────────────────
# Dumps locaux qu'on peut restaurer, du plus récent au plus ancien.
list_local_dumps() {
  [ -d "$DUMP_DIR" ] || return 0
  find "$DUMP_DIR" -maxdepth 1 -type f \( -name 'avant-*.dump' -o -name 'manuel-*.dump' \) \
    -printf '%T@ %p\n' | sort -rn | cut -d' ' -f2-
}

# Télécharge le dump de nuit de B2 choisi par sa date. Affiche le chemin local.
download_nightly_dump() {
  prepare_b2_remote || return 1
  echo "   Dumps de nuit sur B2 :" >&2
  rclone lsf "$B2_REMOTE" --include 'chimeres-*.dump' 2>/dev/null | sort | sed 's/^/     /' >&2 \
    || warn "liste des dumps de B2 impossible : la clé a-t-elle listFiles ?" >&2

  local day
  read -rp "Date du dump (AAAA-MM-JJ) : " day
  if [[ ! "$day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    err "date attendue au format AAAA-MM-JJ (reçu : « $day »)" >&2
    return 1
  fi
  local name="chimeres-$day.dump"
  local file="$DUMP_DIR/$name"
  mkdir -p "$DUMP_DIR"
  if ! rclone copyto "$B2_REMOTE/$name" "$file.part" >&2 || [ ! -s "$file.part" ]; then
    rm -f "$file.part"
    err "$name introuvable ou illisible sur B2." >&2
    return 1
  fi
  mv "$file.part" "$file"
  echo "$file"
}

# Un dump de nuit téléchargé de B2 est effacé à la fin, restauré ou non.
action_restore() {
  DOWNLOADED_DUMP=""
  local status=0
  choose_and_restore_dump || status=$?
  [ -z "$DOWNLOADED_DUMP" ] || rm -f "$DOWNLOADED_DUMP"
  return "$status"
}

choose_and_restore_dump() {
  local dumps=() choice file
  mapfile -t dumps < <(list_local_dumps)

  step "Sauvegardes"
  local i
  for i in "${!dumps[@]}"; do
    printf '  %2d) %-44s %s  %s\n' "$((i + 1))" "$(basename "${dumps[$i]}")" \
      "$(paris_date -r "${dumps[$i]}" '+%d/%m/%Y %H:%M')" "$(du -h "${dumps[$i]}" | cut -f1)"
  done
  [ "${#dumps[@]}" -gt 0 ] || echo "   aucun dump local"
  echo "   b) Dump de nuit sur B2, par sa date"
  read -rp "Choix (vide pour annuler) : " choice

  if [ "$choice" = "b" ]; then
    file="$(download_nightly_dump)" || { err "rien n'a été touché."; return 1; }
    DOWNLOADED_DUMP="$file"
  elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#dumps[@]}" ]; then
    file="${dumps[$((choice - 1))]}"
  else
    warn "restauration annulée, rien n'a été touché."
    return 1
  fi

  # Un dump avant-vX.Y.Z ou avant-restauration-…-vX.Y.Z a le schéma de vX.Y.Z : il relance vX.Y.Z.
  local current_tag tag
  current_tag="$(env_value IMAGE_TAG)"
  if [[ "$(basename "$file")" =~ ^avant-(restauration-[0-9-]+-)?(v[0-9]+\.[0-9]+\.[0-9]+)\.dump$ ]]; then
    tag="${BASH_REMATCH[2]}"
  else
    tag="$current_tag"
  fi
  if [ -z "$tag" ]; then
    err "IMAGE_TAG manque dans $ENV_FILE : version à relancer inconnue. Rien n'a été touché."
    return 1
  fi
  if ! docker image inspect "$IMAGE:$tag" > /dev/null 2>&1 && ! docker pull "$IMAGE:$tag"; then
    err "image $IMAGE:$tag introuvable. Rien n'a été touché."
    return 1
  fi

  echo ""
  echo "   Dump        : $(basename "$file")"
  echo "   Date        : $(paris_date -r "$file" '+%d/%m/%Y à %H:%M') (heure de Paris)"
  echo "   Version     : $tag (en place : ${current_tag:-aucune})"
  warn "la base actuelle sera effacée et remplacée par ce dump."
  local confirm
  read -rp "Taper RESTAURER pour continuer : " confirm
  if [ "$confirm" != "RESTAURER" ]; then
    warn "restauration annulée, rien n'a été touché."
    return 1
  fi

  local before
  before="$(new_dump_path avant-restauration "$current_tag")"
  step "Dump de la base avant la restauration"
  if ! dump_database "$before"; then
    err "dump impossible : restauration arrêtée, rien n'a été touché."
    return 1
  fi
  ok "$before ($(du -h "$before" | cut -f1))"

  if ! restore_and_start "$file" "$tag"; then
    err "CRITIQUE : la restauration a échoué. Intervention manuelle immédiate sur le serveur."
    err "Dump d'avant la restauration : $before (option 4 pour y revenir)."
    return 2
  fi

  # Une autre version tourne : le journal la donne comme N, pour les déploiements suivants.
  local logged_tag
  logged_tag="$(current_tag_from_log)"
  if [ "$tag" != "$logged_tag" ]; then
    echo "$(date -Iseconds) $tag ${logged_tag:--} $before" >> "$LOG_FILE"
  fi
  ok "$(basename "$file") restauré, $tag répond sur https://$(public_domain)"
}

# ── 5. État ──────────────────────────────────────────────────────────
action_status() {
  step "Version qui répond sur https://$(public_domain)"
  local version
  version="$(public_version)"
  echo "   ${version:-aucune réponse}"

  step "Derniers déploiements"
  if [ -f "$LOG_FILE" ]; then tail -n 5 "$LOG_FILE" | sed 's/^/   /'; else echo "   aucun"; fi

  step "Conteneurs"
  compose ps

  step "Derniers dumps"
  if compgen -G "$DUMP_DIR/*.dump" > /dev/null; then
    # shellcheck disable=SC2012 # noms de fichiers produits par ce script, sans espace.
    ls -lht "$DUMP_DIR"/*.dump | head -n 10 | sed 's/^/   /'
    echo "   Place prise : $(du -sh "$DUMP_DIR" | cut -f1)"
  else
    echo "   aucun"
  fi

  step "Images"
  docker images --format '   {{.Repository}}:{{.Tag}}  {{.Size}}' \
    | grep -e "$IMAGE" -e 'postgres' || echo "   aucune"
  echo "   Place prise par toutes les images Docker : $(docker system df --format '{{if eq .Type "Images"}}{{.Size}}{{end}}' | grep -v '^$' || true)"
}

coming_soon() { warn "à venir."; }

menu() {
  while true; do
    echo ""
    echo "=== Histoires de chimères - exploitation ($APP_DIR) ==="
    echo "  1) Déployer une version"
    echo "  2) Revenir à la version précédente"
    echo "  3) Sauvegarder maintenant"
    echo "  4) Restaurer une sauvegarde"
    echo "  5) État"
    echo "  6) Quitter"
    local choice
    read -rp "Choix : " choice || exit 0
    # « || true » : sous set -e, l'échec d'une action ramène au menu au lieu de quitter le script.
    case "$choice" in
      1) action_deploy || true ;;
      2) coming_soon ;;
      3) action_manual_backup || true ;;
      4) action_restore || true ;;
      5) action_status || true ;;
      6) exit 0 ;;
      *) warn "choix invalide." ;;
    esac
  done
}

case "${1:-}" in
  "") menu ;;
  sauvegarde-nuit) action_nightly_backup ;;
  *) action_deploy "$1" ;;
esac
