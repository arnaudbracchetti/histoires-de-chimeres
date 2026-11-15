#!/usr/bin/env bash
# Mesures du serveur pendant un test de charge (docs/load-test/plan.md § 7), toutes les 5 s.
# Lancé par run.sh sur le serveur, par SSH (bash -s) : chaque mesure sort en une ligne CSV, que
# run.sh écrit sur le poste au fil de l'eau. Un Ctrl-C garde donc les mesures déjà prises.
# Usage : collect-server.sh <conteneur PostgreSQL de test2>
# Sans -e ni pipefail : une mesure en échec ne doit pas arrêter la collecte.
set -u

database="$1"

echo "time,source,subject,metric,value"
while true; do
  started=$SECONDS
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Tous les conteneurs de la machine : la production et les autres services comptent aussi.
  docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemPerc}},{{.MemUsage}}' |
    while IFS=, read -r name cpu memory_percent memory_usage; do
      echo "$now,docker,$name,cpu_percent,${cpu%\%}"
      echo "$now,docker,$name,memory_percent,${memory_percent%\%}"
      echo "$now,docker,$name,memory_usage,$memory_usage"
    done

  read -r load1 load5 load15 _ < /proc/loadavg
  echo "$now,host,loadavg,1m,$load1"
  echo "$now,host,loadavg,5m,$load5"
  echo "$now,host,loadavg,15m,$load15"
  free -m | awk -v now="$now" '/^Mem:/ {
    print now ",host,memory,total_mb," $2
    print now ",host,memory,used_mb," $3
    print now ",host,memory,available_mb," $7
  }'

  # Les connexions de la base de test2, par état : 10 actives longtemps, le pool est saturé.
  # shellcheck disable=SC2016 # Les variables se lisent dans le conteneur.
  docker exec "$database" sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F, -c "
    select coalesce(state, '\''inconnu'\''), count(*) from pg_stat_activity
    where datname = current_database() group by 1"' |
    while IFS=, read -r state count; do
      echo "$now,postgres,connections,$state,$count"
    done

  # Une mesure prend environ 2 s (docker stats) : le pas reste de 5 s.
  sleep $((5 - (SECONDS - started) > 0 ? 5 - (SECONDS - started) : 0))
done
