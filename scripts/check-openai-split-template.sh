#!/usr/bin/env bash
# Validate the Mihomo split template without contacting the network or printing keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TPL="$ROOT/clash/openai-split.template.yaml"
fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -f "$TPL" ]] || fail "missing $TPL"
chmod 0755 "$ROOT/scripts/run-on-mac.sh"

# Template must not contain a real-looking committed private key.
if grep -Eq 'private-key:[[:space:]]*[A-Za-z0-9+/]{40,}={0,2}' "$TPL"; then
  fail "template looks like it embeds a real private-key"
fi
grep -q 'REPLACE_FROM_MAC_NEW_DO_NOT_COMMIT' "$TPL" || fail "missing private-key placeholder"

grep -q 'mode: rule' "$TPL" || fail "mode must be rule"
grep -q 'MATCH,DIRECT' "$TPL" || fail "fallback must be MATCH,DIRECT"
grep -q 'IP-CIDR,38.244.17.106/32,DIRECT' "$TPL" || fail "WG endpoint must be DIRECT"
grep -q 'server: 38.244.17.106' "$TPL" || fail "missing WG server"
grep -q 'port: 51820' "$TPL" || fail "missing WG port"
grep -q 'public-key: sRCHVw+s4atumhQ337oC6Yz1lM6dFqCdTpsTt8vqh3g=' "$TPL" || fail "server public-key mismatch"
grep -q 'DOMAIN-SUFFIX,chatgpt.com,OPENAI' "$TPL" || fail "missing chatgpt.com"
grep -q 'DOMAIN-SUFFIX,openai.com,OPENAI' "$TPL" || fail "missing openai.com"
grep -q 'DOMAIN-SUFFIX,oaistatic.com,OPENAI' "$TPL" || fail "missing oaistatic.com"
grep -q 'DOMAIN-SUFFIX,oaiusercontent.com,OPENAI' "$TPL" || fail "missing oaiusercontent.com"
grep -q 'PROCESS-NAME,ChatGPT,OPENAI' "$TPL" || fail "missing ChatGPT process placeholder"

# Shared CDN must stay out of active rule lines (comments may name them).
if awk '/^[[:space:]]*#/ {next} /^[[:space:]]*-[[:space:]]/ {print}' "$TPL" \
  | grep -Eqi 'cloudflare|stripe.com|intercom|sendgrid|sentry.io|datadog'; then
  fail "template proxies a shared CDN hostname"
fi

# Darwin guard on the Mac script.
if [[ "$(uname -s)" != "Darwin" ]]; then
  if "$ROOT/scripts/run-on-mac.sh"; then
    fail "run-on-mac.sh should refuse on $(uname -s)"
  else
    rc=$?
    [[ "$rc" -eq 2 ]] || fail "run-on-mac.sh should exit 2 on non-Darwin, got $rc"
  fi
fi

echo "OK template and Darwin-guard checks passed"
