#!/bin/sh
set -eu
# Un certificat neuf à chaque démarrage : la CA va dans le volume que l'API lit
# (NODE_EXTRA_CA_CERTS), la clé reste dans le conteneur.
/fake-push/make-certificate.sh /ca /tls "${PUSH_HOST:-fake-push}"
exec node /fake-push/main.ts
