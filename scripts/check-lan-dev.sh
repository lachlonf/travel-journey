#!/usr/bin/env bash
# Checks that the dev server serves a page's client JavaScript to a device on the LAN,
# not just to localhost. Next's dev server refuses cross-origin requests for /_next/*
# unless the host is in `allowedDevOrigins`, and a refusal is invisible: the page's
# server-rendered HTML and its CSS still arrive, so it looks styled and complete while
# nothing that needs JavaScript — the globe above all — ever runs. (#26)
#
#   bash scripts/check-lan-dev.sh [path]     # default path: /

set -euo pipefail

PATH_UNDER_TEST="${1:-/}"
HOST="${PROBE_HOST:-$(ipconfig getifaddr en0 2>/dev/null || echo localhost)}"
PORT="${PROBE_PORT:-3000}"
ORIGIN="http://${HOST}:${PORT}"
PAGE="${ORIGIN}${PATH_UNDER_TEST}"

html="$(curl -sS -m 15 "$PAGE")"
scripts="$(printf '%s' "$html" | grep -oE '/_next/static/[^"]+\.js' | sort -u)"
[[ -n "$scripts" ]] || { echo "FAIL: $PAGE served no /_next/static JavaScript to link against"; exit 1; }

echo "checking $(printf '%s\n' "$scripts" | wc -l | tr -d ' ') scripts of $PAGE as a LAN device asks for them"
blocked=0
while read -r src; do
  code="$(curl -sS -o /dev/null -m 15 -w '%{http_code}' -H "Origin: ${ORIGIN}" -H "Referer: ${PAGE}" "${ORIGIN}${src}")"
  if [[ "$code" != "200" ]]; then
    blocked=$((blocked + 1))
    echo "  $code  $src"
  fi
done <<< "$scripts"

if ((blocked > 0)); then
  echo "FAIL: $blocked script(s) not served to ${HOST} — no client JavaScript runs there, so the globe never mounts"
  exit 1
fi
echo "PASS: every script is served to ${HOST}"
