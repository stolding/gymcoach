#!/usr/bin/env bash
# Tunnel van GymCoach (thuis) naar je eigen VPS installeren als gebruikersdiensten.
# Vooraf: GYMCOACH_VPS_HOST (en eventueel GYMCOACH_VPS_USER/KEY) in ~/gymcoach/.env.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
if ! grep -q "^GYMCOACH_VPS_HOST=" "$DIR/../../.env" 2>/dev/null; then echo "Zet eerst GYMCOACH_VPS_HOST=<je-vps> in $(cd "$DIR/../.." && pwd)/.env (zie .env.example)"; exit 1; fi
UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$UNIT_DIR"
chmod +x "$DIR"/*.sh
cp "$DIR"/gymcoach-tunnel.service "$DIR"/gymcoach-tunnel-watch.service "$DIR"/gymcoach-tunnel-watch.timer "$UNIT_DIR"/
systemctl --user daemon-reload
systemctl --user enable --now gymcoach-tunnel.service gymcoach-tunnel-watch.timer
sleep 3
systemctl --user --no-pager status gymcoach-tunnel.service | head -5
bash "$DIR/gymcoach-tunnel-watch.sh"
