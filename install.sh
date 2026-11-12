#!/usr/bin/env bash
# GymCoach installeren op een Linux-server. Uitvoeren vanuit de gymcoach-map:
#   bash install.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$HOME/.local/bin"
CFG_DIR="$HOME/.config/speediance"
CFG="$CFG_DIR/config.json"
CLI="$BIN_DIR/speediance-cli"
CLI_VERSION="v2.0.0"
PORT="${PORT:-8765}"
# Op een VPS achter Plesk/nginx: HOST=127.0.0.1 TRUST_PROXY=1 bash install.sh
HOST="${HOST:-0.0.0.0}"
TRUST_PROXY="${TRUST_PROXY:-}"

echo "== GymCoach installatie in $APP_DIR"

# 1. Node.js >= 22.5 (ingebouwde SQLite)
if ! command -v node >/dev/null 2>&1 || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=5)?0:1)'; then
  echo "Node.js 22.5 of nieuwer is nodig (voor de ingebouwde database). Installeer bijvoorbeeld met:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"
  exit 1
fi
NODE_BIN="$(command -v node)"
echo "Node $(node -v) gevonden"

# 2. speediance-cli
case "$(uname -m)" in
  x86_64|amd64) ARCH=x86_64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "Onbekende architectuur $(uname -m)"; exit 1 ;;
esac
if [ ! -x "$CLI" ]; then
  echo "speediance-cli $CLI_VERSION downloaden ($ARCH)..."
  mkdir -p "$BIN_DIR"
  TMP="$(mktemp -d)"
  curl -fsSL "https://github.com/stozo04/speediance-cli/releases/download/$CLI_VERSION/speediance-cli_Linux_${ARCH}.tar.gz" -o "$TMP/cli.tgz"
  tar xzf "$TMP/cli.tgz" -C "$TMP"
  install -m 0755 "$TMP/speediance-cli" "$CLI"
  rm -rf "$TMP"
fi
echo "speediance-cli: $("$CLI" version 2>/dev/null | head -1)"
echo "Let op: deze losse binary logt in als SOFTWARE. Het Docker-image past tools/speediance-cli-nano.patch toe en logt in als NANO, zodat de iPhone-app en de Gym Monster ingelogd blijven."

# 3. Speediance-accounts stel je per gebruiker in via het dashboard (Instellingen).
#    Een bestaande ~/.config/speediance/config.json wordt bij het aanmaken van de
#    eerste beheerder automatisch aan dat account gekoppeld.

# 4. Exercise-catalogus van jouw account ophalen (optioneel; anders snapshot)
mkdir -p "$APP_DIR/data"

# 5. systemd user-service
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
cat > "$UNIT_DIR/gymcoach.service" <<EOF
[Unit]
Description=GymCoach dashboard (Gym Monster 1)
After=network-online.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/server.js
Environment=PORT=$PORT
Environment=HOST=$HOST
Environment=TRUST_PROXY=$TRUST_PROXY
Environment=TZ=Europe/Amsterdam
Environment=SPEEDIANCE_BIN=$CLI
EnvironmentFile=-$APP_DIR/.env
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now gymcoach.service
# Zorg dat de service ook draait zonder dat je ingelogd bent
if ! loginctl show-user "$USER" -p Linger 2>/dev/null | grep -q yes; then
  echo "Service laten draaien zonder ingelogde sessie (vraagt mogelijk sudo-wachtwoord):"
  sudo loginctl enable-linger "$USER" || echo "  -> sla over; draai later: sudo loginctl enable-linger $USER"
fi

sleep 2
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
if [ "$HOST" = "127.0.0.1" ] || [ "$HOST" = "localhost" ]; then
  echo "== Klaar. GymCoach luistert alleen intern op 127.0.0.1:$PORT."
  echo "   Maak hem bereikbaar via je webserver (reverse proxy naar http://127.0.0.1:$PORT), bijv. https://gymcoach.jouwdomein.nl"
else
  echo "== Klaar. Open het dashboard op: http://${IP:-localhost}:$PORT"
fi
echo "   Eerste keer: maak daar het beheerdersaccount aan en vul bij Instellingen je Speediance-account in."
echo "   Logs:      journalctl --user -u gymcoach -f"
echo "   Herstart:  systemctl --user restart gymcoach"
