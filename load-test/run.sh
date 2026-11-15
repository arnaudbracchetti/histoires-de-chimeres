#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Lance un palier du test de charge contre test2 (docs/load-test/plan.md § 8).
#
# Usage, depuis n'importe quel dossier du dépôt :
#   load-test/run.sh <téléphones> [délai de réponse du push, en ms : 0 par défaut]
#   load-test/run.sh 1            la mesure de référence
#   load-test/run.sh 80 300       le palier 80, avec un push qui répond en 300 ms
#
# Étapes :
#   1. Demande une confirmation tapée. Sans elle, rien ne touche au serveur.
#   2. Contrôle que le dossier visé est celui de test2 (PUBLIC_DOMAIN, projet Compose), que test2 a
#      ses clés VAPID, et qu'elles ne sont pas celles de la production.
#   3. Construit l'image de fake-push sur le poste, la charge sur le serveur si elle a changé, et
#      copie docker-compose.load-test.yml dans le dossier de test2 (jamais dans celui de la prod).
#   4. Remet la base de test2 à zéro (down -v, donc volume db_data), puis relance test2 avec
#      fake-push : les migrations recréent la convention, et l'API l'Organisateur.
#   5. Ouvre le tunnel SSH vers l'administration de fake-push, et appelle son /reset.
#   6. Lance la collecte côté serveur (collect-server.sh), écrite au fil de l'eau sur le poste.
#   7. Lance k6.
#   8. À la fin, ou sur Ctrl-C : rapatrie les statistiques de fake-push et les journaux de app, puis
#      relance test2 sans docker-compose.load-test.yml. Les mesures déjà prises restent.
#
# Résultats : load-test/results/<date>-<téléphones>/ (server.csv, k6.txt, summary.txt,
# summary.json, app.log, fake-push-stats.json).
#
# Variables : celles de load-test/.env (voir .env.example), plus, pour un autre serveur :
#   DEPLOY_HOST, DEPLOY_DIR, DEPLOY_DOMAIN, DEPLOY_SSH_OPTS (les mêmes que scripts/deploy-test.sh),
#   FAKE_PUSH_ADMIN_PORT (port de fake-push sur le 127.0.0.1 du serveur, 9230),
#   FAKE_PUSH_LOCAL_PORT (bout local du tunnel, 9230).
# ============================================================

DEPLOY_HOST="${DEPLOY_HOST:-deploy@test2.nekbet.fr}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/hdc-test2}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-test2.nekbet.fr}"
DEPLOY_SSH_OPTS="${DEPLOY_SSH_OPTS:--i $HOME/.ssh/id_ed25519_ovh -o HostKeyAlias=gaslands.nekbet.fr}"
PRODUCTION_DIR="/opt/hdc"
FAKE_PUSH_ADMIN_PORT="${FAKE_PUSH_ADMIN_PORT:-9230}"
FAKE_PUSH_LOCAL_PORT="${FAKE_PUSH_LOCAL_PORT:-9230}"
PROJECT="histoires-de-chimeres-test2"
APP_CONTAINER="$PROJECT-app-1"
DATABASE_CONTAINER="$PROJECT-database-1"
FAKE_PUSH_IMAGE="histoires-de-chimeres-test2-fake-push:latest"
COMPOSE_TEST2="docker compose -f docker-compose.test2.yml"
COMPOSE_LOAD_TEST="$COMPOSE_TEST2 -f docker-compose.load-test.yml"
HEALTH_TIMEOUT=120

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo ""; echo -e "${CYAN}>> $1${NC}"; }
ok()   { echo -e "${GREEN}   OK : $1${NC}"; }
err()  { echo -e "${RED}   ERREUR : $1${NC}"; }
warn() { echo -e "${YELLOW}   ATTENTION : $1${NC}"; }

# shellcheck disable=SC2086 # DEPLOY_SSH_OPTS se découpe en options.
remote() { ssh -o BatchMode=yes $DEPLOY_SSH_OPTS "$DEPLOY_HOST" "$@"; }

# Attend que app soit « healthy » (commande à lancer sur le serveur).
WAIT_APP_HEALTHY="for i in \$(seq 1 $((HEALTH_TIMEOUT / 5))); do
    [ \"\$(docker inspect -f '{{.State.Health.Status}}' $APP_CONTAINER)\" = healthy ] && exit 0
    sleep 5
  done
  docker logs --tail 50 $APP_CONTAINER
  exit 1"

cd "$(dirname "$0")"

# --- Arguments et poste : rien ne touche encore au serveur. ---

phones="${1:-}"
push_delay_ms="${2:-0}"
if ! [[ "$phones" =~ ^[1-9][0-9]*$ && "$push_delay_ms" =~ ^[0-9]+$ ]]; then
  echo "Usage : load-test/run.sh <téléphones> [délai de réponse du push, en ms]"
  exit 1
fi
[ -f .env ] || { err "load-test/.env manque : cp load-test/.env.example load-test/.env, puis le remplir."; exit 1; }
set -a; . ./.env; set +a
command -v k6 >/dev/null || { err "k6 n'est pas installé."; exit 1; }
[ -f ../packages/contract/dist/index.js ] || { err "contract n'est pas construit : pnpm build à la racine."; exit 1; }
if [ "${BASE_URL:-}" != "https://$DEPLOY_DOMAIN" ]; then
  err "BASE_URL vaut « ${BASE_URL:-rien} », pas https://$DEPLOY_DOMAIN : run.sh ne vise que test2."
  exit 1
fi
if [ -z "${GUARD_URLS:-}" ]; then
  err "GUARD_URLS est vide : le garde-fou doit surveiller la production et les autres services."
  exit 1
fi

# --- 1. Confirmation tapée. ---

echo ""
echo -e "${YELLOW}Test de charge sur $DEPLOY_DOMAIN : $phones téléphone(s), push à $push_delay_ms ms.${NC}"
echo "La base de test2 sera effacée. La machine porte aussi la production et d'autres services."
echo "  - aucune convention n'est en cours ;"
echo "  - les utilisateurs des autres services de la machine sont prévenus."
read -r -p "Tapez « lancer $phones » pour confirmer : " answer
if [ "$answer" != "lancer $phones" ]; then
  echo "Pas de confirmation : rien n'a été touché."
  exit 1
fi

run_dir="results/$(date +%Y%m%d-%H%M%S)-$phones"
mkdir -p "$run_dir"

# --- 2. Contrôles du serveur, en lecture seule. ---

step "Contrôle du dossier de test2 : $DEPLOY_DIR"
remote_domain="$(remote "grep -oP '^PUBLIC_DOMAIN=\K.*' $DEPLOY_DIR/.env" || true)"
if [ "$remote_domain" != "$DEPLOY_DOMAIN" ]; then
  err "PUBLIC_DOMAIN de $DEPLOY_DIR/.env vaut « ${remote_domain:-rien} », pas $DEPLOY_DOMAIN : rien n'a été touché."
  exit 1
fi
vapid_key="$(remote "grep -oP '^VAPID_PUBLIC_KEY=\K.+' $DEPLOY_DIR/.env" || true)"
if [ -z "$vapid_key" ]; then
  err "test2 n'a pas de clés VAPID dans $DEPLOY_DIR/.env : en générer une paire propre à test2."
  exit 1
fi
production_key="$(remote "grep -oP '^VAPID_PUBLIC_KEY=\K.+' $PRODUCTION_DIR/.env" 2>/dev/null || true)"
[ -z "$production_key" ] && warn "clé VAPID de la production illisible : comparaison impossible."
if [ "$vapid_key" = "$production_key" ]; then
  err "test2 a les clés VAPID de la production : lui en donner une paire propre. Rien n'a été touché."
  exit 1
fi
ok "$DEPLOY_DIR/.env vise $DEPLOY_DOMAIN, avec ses propres clés VAPID"

# --- 3. Image de fake-push et fichier de charge. ---

step "Image $FAKE_PUSH_IMAGE"
docker build -q -t "$FAKE_PUSH_IMAGE" fake-push >/dev/null
local_image="$(docker image inspect -f '{{.Id}}' "$FAKE_PUSH_IMAGE")"
remote_image="$(remote "docker image inspect -f '{{.Id}}' $FAKE_PUSH_IMAGE 2>/dev/null" || true)"
if [ "$local_image" != "$remote_image" ]; then
  docker save "$FAKE_PUSH_IMAGE" | gzip | remote 'gunzip | docker load' >/dev/null
  ok "image chargée sur le serveur"
else
  ok "image déjà à jour sur le serveur"
fi
remote "cat > $DEPLOY_DIR/docker-compose.load-test.yml" < docker-compose.load-test.yml
project="$(remote "cd $DEPLOY_DIR && $COMPOSE_LOAD_TEST config --format json" \
  | grep -oP '^\s*"name":\s*"\K[^"]*' | head -n 1 || true)"
if [ "$project" != "$PROJECT" ]; then
  err "Le projet Compose du serveur est « ${project:-inconnu} », pas $PROJECT : rien n'a été relancé."
  exit 1
fi
ok "docker-compose.load-test.yml copié dans $DEPLOY_DIR (projet $PROJECT)"

# --- À partir d'ici, test2 change : la sortie, normale ou non, le remet en état. ---

tunnel_pid=""
collector_pid=""
app_started_at=""

restore_test2() {
  # Un second Ctrl-C, ou une étape en échec, n'interrompt pas la remise en état.
  trap '' INT TERM
  set +e
  [ -n "$collector_pid" ] && kill "$collector_pid" 2>/dev/null
  if [ -n "$tunnel_pid" ]; then
    curl -fsS "http://127.0.0.1:$FAKE_PUSH_LOCAL_PORT/stats" > "$run_dir/fake-push-stats.json" \
      || warn "statistiques de fake-push non lues"
    kill "$tunnel_pid" 2>/dev/null
  fi
  step "Journaux de app"
  if [ -n "$app_started_at" ]; then
    remote "docker logs --since $app_started_at $APP_CONTAINER" > "$run_dir/app.log" 2>&1 \
      || warn "journaux de app non rapatriés"
  fi
  step "Relance de test2 sans docker-compose.load-test.yml"
  if remote "set -e
      cd $DEPLOY_DIR
      $COMPOSE_LOAD_TEST rm --stop --force fake-push
      $COMPOSE_TEST2 up -d --pull never --remove-orphans
      docker network rm ${PROJECT}_chimeres_test2_push_net >/dev/null 2>&1 || true
      docker volume rm ${PROJECT}_fake_push_ca >/dev/null 2>&1 || true
      $WAIT_APP_HEALTHY"; then
    ok "test2 tourne dans sa configuration normale"
  else
    err "test2 ne redémarre pas dans sa configuration normale : intervention manuelle sur le serveur."
  fi
  echo ""
  echo "Résultats : load-test/$run_dir"
}
trap restore_test2 EXIT
trap 'exit 130' INT TERM

# --- 4. Remise à zéro de la base, et test2 avec fake-push. ---

step "Remise à zéro de la base de test2, puis démarrage avec fake-push (max ${HEALTH_TIMEOUT}s)"
# L'heure du serveur : c'est elle que lit docker logs --since.
app_started_at="$(remote 'date -u +%Y-%m-%dT%H:%M:%SZ')"
# Un Ctrl-C ici couperait le SSH, pas les commandes compose du serveur, qui tourneraient en même
# temps que la remise en état : il attend la fin de l'étape.
trap '' INT
remote "set -e
  cd $DEPLOY_DIR
  export FAKE_PUSH_DELAY_MS=$push_delay_ms FAKE_PUSH_ADMIN_PORT=$FAKE_PUSH_ADMIN_PORT
  $COMPOSE_LOAD_TEST down --volumes --remove-orphans
  $COMPOSE_LOAD_TEST up -d --pull never
  $WAIT_APP_HEALTHY"
trap 'exit 130' INT
ok "base vide, test2 en ligne avec fake-push"

# --- 5. Tunnel vers l'administration de fake-push. ---

step "Tunnel SSH vers fake-push"
# shellcheck disable=SC2086 # DEPLOY_SSH_OPTS se découpe en options.
ssh -N -o BatchMode=yes -o ExitOnForwardFailure=yes $DEPLOY_SSH_OPTS \
  -L "127.0.0.1:$FAKE_PUSH_LOCAL_PORT:127.0.0.1:$FAKE_PUSH_ADMIN_PORT" "$DEPLOY_HOST" &
tunnel_pid=$!
fake_push_url="http://127.0.0.1:$FAKE_PUSH_LOCAL_PORT"
for _ in $(seq 1 20); do
  curl -fsS -o /dev/null "$fake_push_url/health" 2>/dev/null && break
  sleep 0.5
done
curl -fsS -X POST -o /dev/null "$fake_push_url/reset"
ok "fake-push joint sur $fake_push_url, remis à zéro"

# --- 6. Collecte côté serveur. ---

step "Collecte du serveur dans $run_dir/server.csv"
# ssh appelé directement, pas par remote() : $! doit être le pid de ssh, pas celui d'un sous-shell,
# sinon kill laisse la collecte tourner. La boucle du serveur s'arrête quand ssh se ferme.
# shellcheck disable=SC2086 # DEPLOY_SSH_OPTS se découpe en options.
ssh -o BatchMode=yes $DEPLOY_SSH_OPTS "$DEPLOY_HOST" "bash -s -- $DATABASE_CONTAINER" \
  < collect-server.sh > "$run_dir/server.csv" &
collector_pid=$!
ok "toutes les 5 s"

# --- 7. k6. ---

step "k6 : $phones téléphone(s)"
set +e
# tee -i, et le filtre qui ignore SIGINT : un Ctrl-C arrête k6, mais pas l'écriture de son résumé.
# Le fichier garde tout sauf la barre de progression, réécrite à chaque seconde.
PHONES="$phones" FAKE_PUSH_URL="$fake_push_url" RESULTS_DIR="$run_dir" k6 run k6/load-test.ts 2>&1 \
  | tee -i >(trap '' INT; exec grep --line-buffered -vE '\[ *[0-9]+% \]|^running \(' > "$run_dir/k6.txt")
k6_status=${PIPESTATUS[0]}
set -e
if [ "$k6_status" -eq 0 ]; then ok "k6 terminé"; else err "k6 s'est arrêté avec le code $k6_status"; fi
exit "$k6_status"
