# Faux service de push du test de charge (docs/load-test/plan.md § 6). Sans dépendance npm :
# Node lit le TypeScript lui-même, et openssl fabrique le certificat au démarrage.
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /fake-push
COPY make-certificate.sh entrypoint.sh fake-push.ts main.ts ./
ENV NODE_ENV=production
EXPOSE 8443 8081
HEALTHCHECK --interval=2s --timeout=2s --retries=15 \
  CMD wget -qO- http://127.0.0.1:${ADMIN_PORT:-8081}/health || exit 1
ENTRYPOINT ["/fake-push/entrypoint.sh"]
