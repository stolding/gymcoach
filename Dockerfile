# GymCoach als container: Node.js 22 (ingebouwde SQLite) + speediance-cli.
#   docker compose up -d      (zie docker-compose.yml)
# Alle gegevens staan in het volume /data.
# De CLI wordt gebouwd uit v2.0.0 met tools/speediance-cli-nano.patch:
# inloggen als NANO, niet als SOFTWARE of HARDWARE.
FROM golang:1.24-bookworm AS cli
ARG CLI_VERSION=v2.0.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl patch \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN curl -fsSL "https://github.com/stozo04/speediance-cli/archive/refs/tags/${CLI_VERSION}.tar.gz" | tar -xz --strip-components=1
COPY tools/speediance-cli-nano.patch /tmp/speediance-cli-nano.patch
RUN patch -p1 < /tmp/speediance-cli-nano.patch \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/speediance-cli ./cmd/speediance-cli

FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tzdata \
 && rm -rf /var/lib/apt/lists/*
COPY --from=cli /out/speediance-cli /usr/local/bin/speediance-cli

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
