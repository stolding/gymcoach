#!/usr/bin/env bash
set -euo pipefail
# GymCoach lokaal ok? Dan via de VPS 127.0.0.1:18765 testen; geen antwoord = tunnel herstarten.
HOST="${GYMCOACH_VPS_HOST:?Zet GYMCOACH_VPS_HOST (adres van je eigen VPS) in ~/gymcoach/.env}"
USER="${GYMCOACH_VPS_USER:-root}"
PORT="${GYMCOACH_VPS_TUNNEL_PORT:-18765}"
LOCAL_PORT="${GYMCOACH_LOCAL_PORT:-8765}"
KEY="${GYMCOACH_VPS_KEY:-$HOME/.ssh/id_ed25519}"
LOCK="${XDG_RUNTIME_DIR:-/tmp}/gymcoach-tunnel-watch.lock"
STAMP="${XDG_RUNTIME_DIR:-/tmp}/gymcoach-tunnel-watch.restart"
COOLDOWN=120
exec 9>"$LOCK"; flock -n 9 || exit 0
code="$(curl -sS -m 4 -o /dev/null -w '%{http_code}' "http://127.0.0.1:${LOCAL_PORT}/api/auth/status" || true)"
[[ "$code" =~ ^[1-5][0-9]{2}$ ]] || { echo "GymCoach lokaal niet bereikbaar; tunnel niet herstarten"; exit 0; }
remote="$(ssh -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new -i "$KEY" "${USER}@${HOST}" \
  "curl -sS -m 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:${PORT}/api/auth/status" || true)"
remote="${remote//$'\r'/}"
[[ "$remote" =~ ^[1-5][0-9]{2}$ ]] && { echo "tunnel ok (HTTP $remote)"; exit 0; }
now=$(date +%s)
if [[ -f "$STAMP" ]] && (( now - $(stat -c %Y "$STAMP") < COOLDOWN )); then echo "tunnel stuk; cooldown"; exit 0; fi
touch "$STAMP"; echo "tunnel stuk (HTTP ${remote:-timeout}); herstart gymcoach-tunnel"
systemctl --user restart gymcoach-tunnel.service
