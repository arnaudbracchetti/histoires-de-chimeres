#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# POUR LES TESTS SEULEMENT, à supprimer avec la fonctionnalité.
#
# Annule la publication du dernier tirage publié (scripts/unpublish-last-draw.sql).
#
# Usage, depuis n'importe quel dossier du dépôt :
#   scripts/unpublish-last-draw.sh          sur le serveur de test (test2.nekbet.fr)
#   scripts/unpublish-last-draw.sh dev      sur la base de dev (pnpm dev:db)
#
# Variables, pour un autre serveur ou une autre clé : les mêmes que scripts/deploy-test.sh.
# ============================================================

DEPLOY_HOST="${DEPLOY_HOST:-deploy@test2.nekbet.fr}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/deploy/histoires-de-chimeres}"
# test2.nekbet.fr est le serveur gaslands.nekbet.fr : sa clé d'hôte est connue sous ce nom.
DEPLOY_SSH_OPTS="${DEPLOY_SSH_OPTS:--i $HOME/.ssh/id_ed25519_ovh -o HostKeyAlias=gaslands.nekbet.fr}"

cd "$(git rev-parse --show-toplevel)"
SQL=scripts/unpublish-last-draw.sql

case "${1:-test}" in
  dev)
    docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U chimeres -d chimeres < "$SQL"
    ;;
  test)
    read -r -p "Annuler la publication du dernier tirage sur ${DEPLOY_HOST#*@} ? [o/N] " answer
    [[ "$answer" =~ ^[oO]$ ]] || { echo "Abandon."; exit 1; }
    # shellcheck disable=SC2086 # DEPLOY_SSH_OPTS se découpe en options.
    ssh -o BatchMode=yes $DEPLOY_SSH_OPTS "$DEPLOY_HOST" \
      "cd $DEPLOY_DIR && docker compose -f docker-compose.prod.yml exec -T database \
        sh -c 'psql -v ON_ERROR_STOP=1 -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\"'" < "$SQL"
    ;;
  *)
    echo "Usage : $0 [dev|test]" >&2
    exit 2
    ;;
esac
