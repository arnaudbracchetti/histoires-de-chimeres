#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Déploie la version courante du dépôt sur le serveur de test (test2.nekbet.fr).
#
# Usage, depuis n'importe quel dossier du dépôt :
#   scripts/deploy-test.sh          tag : <commit court>, suivi de -wip-<date> si le dépôt
#                                   a des changements non commités
#   scripts/deploy-test.sh <tag>    tag choisi
#
# Étapes :
#   1. Construit l'image de production (Dockerfile) sur ce poste.
#   2. La copie sur le serveur par SSH (docker save | docker load), sans passer par ghcr.
#   3. Change IMAGE_TAG dans le .env du serveur, puis relance le conteneur sans pull :
#      les migrations Prisma s'appliquent à son démarrage.
#   4. Attend qu'il soit « healthy », puis vérifie /api/health par HTTPS.
#   5. En cas d'échec, revient au tag précédent.
#   6. Garde sur le serveur l'image courante et la précédente, et efface les autres.
#
# Variables, pour un autre serveur ou une autre clé :
#   DEPLOY_HOST (deploy@test2.nekbet.fr), DEPLOY_DIR (/home/deploy/histoires-de-chimeres),
#   DEPLOY_DOMAIN (test2.nekbet.fr), DEPLOY_SSH_OPTS (clé et alias de la clé d'hôte).
# ============================================================

DEPLOY_HOST="${DEPLOY_HOST:-deploy@test2.nekbet.fr}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/deploy/histoires-de-chimeres}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-test2.nekbet.fr}"
# test2.nekbet.fr est le serveur gaslands.nekbet.fr : sa clé d'hôte est connue sous ce nom.
DEPLOY_SSH_OPTS="${DEPLOY_SSH_OPTS:--i $HOME/.ssh/id_ed25519_ovh -o HostKeyAlias=gaslands.nekbet.fr}"
IMAGE="ghcr.io/arnaudbracchetti/histoires-de-chimeres-app"
CONTAINER="histoires-de-chimeres-prod-app-1"
HEALTH_TIMEOUT=120

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo ""; echo -e "${CYAN}>> $1${NC}"; }
ok()   { echo -e "${GREEN}   OK : $1${NC}"; }
err()  { echo -e "${RED}   ERREUR : $1${NC}"; }
warn() { echo -e "${YELLOW}   ATTENTION : $1${NC}"; }

# shellcheck disable=SC2086 # DEPLOY_SSH_OPTS se découpe en options.
remote() { ssh -o BatchMode=yes $DEPLOY_SSH_OPTS "$DEPLOY_HOST" "$@"; }

cd "$(git rev-parse --show-toplevel)"

tag="${1:-}"
if [ -z "$tag" ]; then
  tag="$(git rev-parse --short HEAD)"
  if [ -n "$(git status --porcelain)" ]; then
    tag="$tag-wip-$(date +%Y%m%d-%H%M)"
    warn "Changements non commités : ils partent dans l'image $tag."
  fi
fi

step "Version actuelle du serveur"
previous_tag="$(remote "grep -oP '^IMAGE_TAG=\K.*' $DEPLOY_DIR/.env" || true)"
echo "   ${previous_tag:-inconnue}"

step "Construction de l'image $IMAGE:$tag"
docker build -t "$IMAGE:$tag" .
ok "image construite"

step "Copie de l'image sur $DEPLOY_HOST"
docker save "$IMAGE:$tag" | gzip | remote 'gunzip | docker load'
ok "image chargée sur le serveur"

# Change IMAGE_TAG, relance sans pull (l'image n'est pas sur ghcr) et attend le « healthy ».
start_tag() {
  remote "set -e
    cd $DEPLOY_DIR
    sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$1/' .env
    docker compose -f docker-compose.prod.yml up -d --pull never
    for i in \$(seq 1 $((HEALTH_TIMEOUT / 5))); do
      [ \"\$(docker inspect -f '{{.State.Health.Status}}' $CONTAINER)\" = healthy ] && exit 0
      sleep 5
    done
    docker logs --tail 50 $CONTAINER
    exit 1"
}

step "Démarrage de $tag (max ${HEALTH_TIMEOUT}s)"
remote "cp $DEPLOY_DIR/.env $DEPLOY_DIR/.env.bak"
if start_tag "$tag" && curl -fsS -o /dev/null "https://$DEPLOY_DOMAIN/api/health"; then
  ok "$tag est en ligne sur https://$DEPLOY_DOMAIN"
else
  err "$tag ne démarre pas, ou /api/health ne répond pas."
  if [ -z "$previous_tag" ]; then
    err "Pas de version précédente connue : intervention manuelle sur le serveur."
    exit 1
  fi
  warn "Retour à $previous_tag"
  if start_tag "$previous_tag"; then
    err "Déploiement de $tag annulé : $previous_tag est de nouveau en ligne."
    exit 1
  fi
  err "CRITIQUE : $previous_tag ne redémarre pas non plus. Intervention manuelle sur le serveur."
  exit 2
fi

step "Nettoyage des anciennes images du serveur"
remote "docker images '$IMAGE' --format '{{.Tag}}' \
  | grep -vxF -e '$tag' -e '${previous_tag:-$tag}' \
  | sed 's|^|$IMAGE:|' | xargs -r docker rmi" || warn "nettoyage incomplet"
ok "gardées : $tag et ${previous_tag:-aucune autre}"
