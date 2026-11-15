#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Déploie la version courante du dépôt sur le serveur de test (test2.nekbet.fr).
#
# test2 partage la machine de la production (hdc.nekbet.fr, /opt/hdc), mais rien d'autre : son
# propre dossier, son projet Compose histoires-de-chimeres-test2 (docker-compose.test2.yml, donc
# ses conteneurs, son réseau et son volume), son image locale histoires-de-chimeres-test2-app,
# son alias chimeres-test2-app et son site Caddy (histoires-de-chimeres-test2.caddy).
#
# Usage, depuis n'importe quel dossier du dépôt :
#   scripts/deploy-test.sh          tag : <commit court>, suivi de -wip-<date> si le dépôt
#                                   a des changements non commités
#   scripts/deploy-test.sh <tag>    tag choisi
#
# Étapes :
#   0. Refuse de partir si le dossier visé n'est pas celui de test2 : .env absent, PUBLIC_DOMAIN
#      différent de DEPLOY_DOMAIN, ou projet Compose qui n'est pas histoires-de-chimeres-test2.
#   1. Construit l'image de production (Dockerfile) sur ce poste, sous le nom local de test2.
#   2. La copie sur le serveur par SSH (docker save | docker load), sans passer par ghcr, avec
#      docker-compose.test2.yml.
#   3. Change IMAGE_TAG dans le .env du serveur, puis relance test2 sans pull :
#      les migrations Prisma s'appliquent à son démarrage.
#   4. Attend qu'il soit « healthy », puis vérifie /api/health par HTTPS.
#   5. En cas d'échec, revient au tag précédent.
#   6. Garde sur le serveur l'image courante et la précédente de test2, et efface ses autres
#      images. Les images ghcr de la production ne sont jamais touchées.
#
# Variables, pour un autre serveur ou une autre clé :
#   DEPLOY_HOST (deploy@test2.nekbet.fr), DEPLOY_DIR (/opt/hdc-test2),
#   DEPLOY_DOMAIN (test2.nekbet.fr), DEPLOY_SSH_OPTS (clé et alias de la clé d'hôte).
# ============================================================

DEPLOY_HOST="${DEPLOY_HOST:-deploy@test2.nekbet.fr}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/hdc-test2}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-test2.nekbet.fr}"
# test2.nekbet.fr est le serveur gaslands.nekbet.fr : sa clé d'hôte est connue sous ce nom.
DEPLOY_SSH_OPTS="${DEPLOY_SSH_OPTS:--i $HOME/.ssh/id_ed25519_ovh -o HostKeyAlias=gaslands.nekbet.fr}"
COMPOSE_FILE="docker-compose.test2.yml"
PROJECT="histoires-de-chimeres-test2"
IMAGE="histoires-de-chimeres-test2-app"
CONTAINER="$PROJECT-app-1"
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

step "Contrôle du dossier de test2 : $DEPLOY_DIR"
grep -qx "name: $PROJECT" "$COMPOSE_FILE" || { err "$COMPOSE_FILE ne déclare pas name: $PROJECT."; exit 1; }
remote_domain="$(remote "grep -oP '^PUBLIC_DOMAIN=\K.*' $DEPLOY_DIR/.env" || true)"
if [ "$remote_domain" != "$DEPLOY_DOMAIN" ]; then
  err "PUBLIC_DOMAIN de $DEPLOY_DIR/.env vaut « ${remote_domain:-rien} », pas $DEPLOY_DOMAIN : rien n'a été touché."
  exit 1
fi
ok "$DEPLOY_DIR/.env vise $DEPLOY_DOMAIN"

step "Version actuelle du serveur"
previous_tag="$(remote "grep -oP '^IMAGE_TAG=\K.*' $DEPLOY_DIR/.env" || true)"
echo "   ${previous_tag:-inconnue}"

step "Construction de l'image $IMAGE:$tag"
docker build -t "$IMAGE:$tag" .
ok "image construite"

step "Copie de l'image sur $DEPLOY_HOST"
docker save "$IMAGE:$tag" | gzip | remote 'gunzip | docker load'
remote "cat > $DEPLOY_DIR/$COMPOSE_FILE" < "$COMPOSE_FILE"
project="$(remote "cd $DEPLOY_DIR && IMAGE_TAG=$tag docker compose -f $COMPOSE_FILE config --format json" \
  | grep -oP '^\s*"name":\s*"\K[^"]*' | head -n 1)"
if [ "$project" != "$PROJECT" ]; then
  err "Le projet Compose du serveur est « ${project:-inconnu} », pas $PROJECT : rien n'a été relancé."
  exit 1
fi
ok "image et $COMPOSE_FILE chargés sur le serveur (projet $PROJECT)"

# Change IMAGE_TAG, relance sans pull (l'image n'est pas sur ghcr) et attend le « healthy ».
start_tag() {
  remote "set -e
    cd $DEPLOY_DIR
    # Sans la ligne, $COMPOSE_FILE refuse de démarrer : on l'ajoute.
    grep -q '^IMAGE_TAG=' .env && sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=$1/' .env || echo 'IMAGE_TAG=$1' >> .env
    docker compose -f $COMPOSE_FILE up -d --pull never
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

step "Nettoyage des anciennes images de test2 sur le serveur"
remote "docker images '$IMAGE' --format '{{.Tag}}' \
  | grep -vxF -e '$tag' -e '${previous_tag:-$tag}' \
  | sed 's|^|$IMAGE:|' | xargs -r docker rmi" || warn "nettoyage incomplet"
ok "gardées : $tag et ${previous_tag:-aucune autre}"
