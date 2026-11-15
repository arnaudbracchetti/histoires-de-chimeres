#!/bin/sh
set -eu

# Une autorité de certification jetable, et le certificat https de fake-push qu'elle signe.
# Usage : make-certificate.sh <dossier de la CA> <dossier du certificat> <nom d'hôte>
# Écrit <CA>/ca.pem (à donner à l'API par NODE_EXTRA_CA_CERTS), <certificat>/key.pem et cert.pem.
# Refaits à chaque démarrage : rien ne survit au lancement.

ca_dir="$1"
tls_dir="$2"
host="$3"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 2 \
  -subj "/CN=fake-push CA" -keyout "$work/ca-key.pem" -out "$work/ca.pem" 2>/dev/null
openssl req -new -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes \
  -subj "/CN=$host" -keyout "$work/key.pem" -out "$work/request.pem" 2>/dev/null
printf 'subjectAltName=DNS:%s\nextendedKeyUsage=serverAuth\n' "$host" > "$work/extensions.cnf"
openssl x509 -req -in "$work/request.pem" -CA "$work/ca.pem" -CAkey "$work/ca-key.pem" \
  -CAcreateserial -days 2 -extfile "$work/extensions.cnf" -out "$work/cert.pem" 2>/dev/null

mkdir -p "$ca_dir" "$tls_dir"
cp "$work/key.pem" "$work/cert.pem" "$tls_dir/"
cp "$work/ca.pem" "$ca_dir/ca.pem"
