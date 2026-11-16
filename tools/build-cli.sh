#!/usr/bin/env bash
# Bouwt speediance-cli met tools/speediance-cli-nano.patch en zet die klaar.
# Een binary die al NANO is en nieuwer is dan de patch blijft staan.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI_VERSION="${CLI_VERSION:-v2.0.0}"
GO_VERSION="${GO_VERSION:-1.24.11}"
BIN_DIR="${BIN_DIR:-$HOME/.local/bin}"
CLI="${SPEEDIANCE_BIN:-$BIN_DIR/speediance-cli}"
case "$CLI" in
  */*) ;;
  *) CLI="$BIN_DIR/speediance-cli" ;;
esac
PATCH="$ROOT/tools/speediance-cli-nano.patch"

if [ -x "$CLI" ] && "$CLI" version 2>/dev/null | grep -q 'NANO' && [ "$CLI" -nt "$PATCH" ]; then
  echo "speediance-cli is al NANO: $("$CLI" version 2>/dev/null | head -1)"
  exit 0
fi

case "$(uname -m)" in
  x86_64|amd64) GOARCH=amd64 ;;
  aarch64|arm64) GOARCH=arm64 ;;
  *) echo "Onbekende architectuur $(uname -m)" >&2; exit 1 ;;
esac

CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/gymcoach"
GO_ROOT="$CACHE/go"
if ! "$GO_ROOT/bin/go" version 2>/dev/null | grep -q "go${GO_VERSION} "; then
  echo "Go $GO_VERSION ophalen…"
  mkdir -p "$CACHE"
  TMP="$(mktemp -d)"
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${GOARCH}.tar.gz" -o "$TMP/go.tgz"
  rm -rf "$GO_ROOT"
  tar -C "$CACHE" -xzf "$TMP/go.tgz"
  rm -rf "$TMP"
fi

echo "speediance-cli $CLI_VERSION bouwen als NANO…"
SRC="$(mktemp -d)"
trap 'rm -rf "$SRC"' EXIT
curl -fsSL "https://github.com/stozo04/speediance-cli/archive/refs/tags/${CLI_VERSION}.tar.gz" | tar -xz --strip-components=1 -C "$SRC"
if command -v patch >/dev/null 2>&1; then
  patch -p1 -d "$SRC" < "$PATCH"
elif command -v git >/dev/null 2>&1; then
  git -C "$SRC" apply -p1 "$PATCH"
else
  echo "patch of git is nodig om de NANO-patch toe te passen" >&2
  exit 1
fi
mkdir -p "$BIN_DIR"
OUT="$SRC/speediance-cli"
( cd "$SRC" && CGO_ENABLED=0 "$GO_ROOT/bin/go" build -trimpath -ldflags="-s -w" -o "$OUT" ./cmd/speediance-cli )
if ! "$OUT" version 2>/dev/null | grep -q 'NANO'; then
  echo "De gebouwde speediance-cli meldt geen NANO" >&2
  exit 1
fi
install -m 0755 "$OUT" "$CLI"
echo "speediance-cli staat op $CLI: $("$CLI" version 2>/dev/null | head -1)"
