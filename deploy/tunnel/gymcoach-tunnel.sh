#!/usr/bin/env bash
set -euo pipefail
# Reverse SSH: VPS 127.0.0.1:18765 -> deze machine 127.0.0.1:8765 (GymCoach).
# Instellingen in ~/gymcoach/.env: GYMCOACH_VPS_HOST (verplicht), GYMCOACH_VPS_USER, GYMCOACH_VPS_KEY, GYMCOACH_VPS_TUNNEL_PORT.
HOST="${GYMCOACH_VPS_HOST:?Zet GYMCOACH_VPS_HOST (adres van je eigen VPS) in ~/gymcoach/.env}"
USER="${GYMCOACH_VPS_USER:-root}"
PORT="${GYMCOACH_VPS_TUNNEL_PORT:-18765}"
LOCAL_PORT="${GYMCOACH_LOCAL_PORT:-8765}"
KEY="${GYMCOACH_VPS_KEY:-$HOME/.ssh/id_ed25519}"
SSH=(ssh)
command -v autossh >/dev/null && SSH=(autossh -M 0)
exec "${SSH[@]}" -N -i "$KEY" \
  -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=accept-new \
  -R "127.0.0.1:${PORT}:127.0.0.1:${LOCAL_PORT}" \
  "${USER}@${HOST}"
