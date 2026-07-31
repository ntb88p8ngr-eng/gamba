# ═══════════════════════════════════════════════════════════
#  GAMBAKING — Container
#  Reines Node ohne Abhängigkeiten: kein npm install, kein Build.
#  Das Image bringt nur die Laufzeit und die Dateien mit.
# ═══════════════════════════════════════════════════════════
FROM node:22-alpine

# dumb-init fängt SIGTERM sauber ab, damit `docker stop` die Daten noch sichert
RUN apk add --no-cache dumb-init

WORKDIR /app

# Quellcode. Was nicht ins Image gehört, steht in .dockerignore
COPY --chown=node:node . .

# Spielstände liegen im Volume, nicht im Image
RUN mkdir -p /data && chown -R node:node /data

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
