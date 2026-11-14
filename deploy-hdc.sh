#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Exploitation d'Histoires de chimères sur le serveur de production (hdc.nekbet.fr).
# Copié à la main dans le dossier du compte deploy. Modèle : deploy-agilometre.sh.
#
# Usage :
#   ./deploy-hdc.sh vX.Y.Z   déploie cette version
#   ./deploy-hdc.sh          menu
#
# Déployer :
#   1. Refuse un tag hors format vX.Y.Z, ou plus ancien que N-1 (renvoi vers la restauration).
#   2. Tire l'image : si elle manque sur ghcr, arrêt sans rien toucher.
#   3. Fait un dump de la base : sauvegardes/avant-vX.Y.Z.dump.
#   4. Met IMAGE_TAG dans .env et relance : les migrations s'appliquent au démarrage de l'app.
#   5. Attend le « healthy », puis vérifie par HTTPS que /api/health renvoie le nouveau tag.
#   6. Ajoute une ligne à deploiements.log, puis efface les images de l'app autres que N et N-1.
#
# En cas d'échec : arrêt de l'app, base recréée vide, pg_restore du dump de l'étape 3, relance
# de la version précédente. Au premier déploiement, sans version précédente : arrêt avec l'erreur.
#
# deploiements.log, une ligne par déploiement réussi : date, tag déployé, tag précédent (- s'il n'y
# en a pas), dump fait avant. La dernière ligne donne la version en place (N) et la précédente (N-1).
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

public_domain() { grep -oP '^PUBLIC_DOMAIN=\K.*' "$ENV_FILE" || true; }

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
  # shellcheck disable=SC2016 # les variables se lisent dans le conteneur.
  if compose exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$file.part" \
    && [ -s "$file.part" ]; then
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
    || return 1
  # shellcheck disable=SC2016 # idem.
  compose exec -T database sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error' \
    < "$file"
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
    return 0
  fi

  if [ -z "$current_tag" ]; then
    err "Premier déploiement : pas de version précédente, ni retour ni restauration."
    err "Corriger l'erreur ci-dessus, puis relancer le déploiement."
    return 1
  fi

  warn "Retour à $current_tag avec le dump fait avant $new_tag"
  step "Arrêt de l'app et restauration de $dump"
  if compose stop app && restore_database "$dump"; then
    ok "base restaurée"
    step "Démarrage de $current_tag"
    if start_app "$current_tag"; then
      ok "$current_tag répond de nouveau"
      err "Le déploiement de $new_tag a échoué et a été annulé. Voir le journal ci-dessus."
      return 1
    fi
  fi
  err "CRITIQUE : le retour à $current_tag a échoué. Intervention manuelle immédiate sur le serveur."
  err "Dump d'avant le déploiement : $dump"
  return 2
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
      2|3|4) coming_soon ;;
      5) action_status || true ;;
      6) exit 0 ;;
      *) warn "choix invalide." ;;
    esac
  done
}

if [ $# -ge 1 ]; then
  action_deploy "$1"
else
  menu
fi
