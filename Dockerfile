# GymCoach als container: Node.js 22 (ingebouwde SQLite) + speediance-cli.
#   docker compose up -d      (zie docker-compose.yml)
# Alle gegevens staan in het volume /data.
FROM node:22-bookworm-slim

ARG TARGETARCH
ARG CLI_VERSION=v2.0.0

# speediance-cli (de onofficiële Speediance-client) voor de juiste processorarchitectuur
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl tzdata \
 && case "$TARGETARCH" in amd64|"") ARCH=x86_64 ;; arm64) ARCH=arm64 ;; *) echo "niet ondersteund: $TARGETARCH" && exit 1 ;; esac \
 && curl -fsSL "https://github.com/stozo04/speediance-cli/releases/download/${CLI_VERSION}/speediance-cli_Linux_${ARCH}.tar.gz" | tar xz -C /usr/local/bin speediance-cli \
 && chmod 0755 /usr/local/bin/speediance-cli \
 && apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    GYMCOACH_RUNTIME=docker \
    GYMCOACH_DATA=/data \
    SPEEDIANCE_BIN=/usr/local/bin/speediance-cli \
    HOST=0.0.0.0 \
    PORT=8765 \
    TZ=Europe/Amsterdam

USER node
VOLUME ["/data"]
EXPOSE 8765

# gezond als de server antwoordt
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8765)+'/api/auth/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
