#!/usr/bin/env bash
# Readonly Mac snapshot for WireGuard handshake diagnosis.
# Darwin only. Never prints PrivateKey, PresharedKey, or passwords.
# Does not change tunnels, firewall, Clash, or Shadowrocket.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "REFUSE: scripts/run-on-mac.sh must run on macOS (Darwin). This host is $(uname -s)." >&2
  exit 2
fi

umask 077
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT="${CURSOR_WG_DIAG_DIR:-$HOME/cursor-wg-diag-$STAMP}"
mkdir -p "$OUT"
chmod 700 "$OUT"
REPORT="$OUT/mac-readonly.txt"
TMPDIR_SAFE=$(mktemp -d "$OUT/tmp.XXXXXX")
chmod 700 "$TMPDIR_SAFE"
cleanup() { rm -rf "$TMPDIR_SAFE"; }
trap cleanup EXIT
: > "$REPORT"
chmod 600 "$REPORT"

derive_pubkey() {
  local src="$1"
  local tmp="$TMPDIR_SAFE/pk"
  : > "$tmp"
  chmod 600 "$tmp"
  awk -F= '
    $1 ~ /^[[:space:]]*PrivateKey[[:space:]]*$/ {
      key=$2
      sub(/^[[:space:]]+/, "", key)
      sub(/[[:space:]]+$/, "", key)
      print key
      exit
    }
  ' "$src" > "$tmp"
  if [[ ! -s "$tmp" ]]; then
    echo "UNAVAILABLE"
    return 0
  fi
  if ! command -v wg >/dev/null 2>&1; then
    echo "WG_TOOL_MISSING"
    rm -f "$tmp"
    return 0
  fi
  wg pubkey < "$tmp" || echo "DERIVE_FAILED"
  rm -P "$tmp" 2>/dev/null || rm -f "$tmp"
}

psk_fingerprint() {
  local src="$1"
  local tmp="$TMPDIR_SAFE/psk"
  : > "$tmp"
  chmod 600 "$tmp"
  awk -F= '
    $1 ~ /^[[:space:]]*PresharedKey[[:space:]]*$/ {
      key=$2
      sub(/^[[:space:]]+/, "", key)
      sub(/[[:space:]]+$/, "", key)
      print key
      exit
    }
  ' "$src" > "$tmp"
  if [[ ! -s "$tmp" ]]; then
    echo "PSK=no"
    rm -f "$tmp"
    return 0
  fi
  echo "PSK=yes sha256=$(shasum -a 256 "$tmp" | awk '{print $1}')"
  rm -P "$tmp" 2>/dev/null || rm -f "$tmp"
}

{
  echo "=== host ==="
  date -u
  uname -a
  sw_vers
  echo "USER=$USER HOME=$HOME"

  echo
  echo "=== path to 38.244.17.106 ==="
  route -n get 38.244.17.106 || true
  echo
  echo "=== inet routes ==="
  netstat -rn -f inet || true

  echo
  echo "=== interfaces (addrs only) ==="
  ifconfig -a | awk '/^[a-z]|inet |status|mtu/'

  echo
  echo "=== scutil VPN ==="
  scutil --nc list || true

  echo
  echo "=== proxy ==="
  scutil --proxy || true
  env | awk -F= 'toupper($1) ~ /(HTTP|HTTPS|ALL)_?PROXY/ {print $1"=set"}'

  echo
  echo "=== tailscale ==="
  if command -v tailscale >/dev/null 2>&1; then
    tailscale status || true
  else
    echo "tailscale not in PATH"
  fi

  echo
  echo "=== installed apps of interest ==="
  ls /Applications 2>/dev/null | grep -iE 'clash|verge|mihomo|shadowrocket|wireguard|chatgpt' || true
  mdfind "kMDItemKind == 'Application'" 2>/dev/null | grep -iE 'clash|verge|mihomo|chatgpt|openai|shadowrocket|wireguard' || true

  echo
  echo "=== ChatGPT bundle ==="
  if [[ -d /Applications/ChatGPT.app ]]; then
    echo "path=/Applications/ChatGPT.app"
    defaults read /Applications/ChatGPT.app/Contents/Info CFBundleIdentifier 2>/dev/null || true
    defaults read /Applications/ChatGPT.app/Contents/Info CFBundleExecutable 2>/dev/null || true
    if [[ -x /Applications/ChatGPT.app/Contents/MacOS/ChatGPT ]]; then
      echo "exec=/Applications/ChatGPT.app/Contents/MacOS/ChatGPT"
    fi
  else
    echo "ChatGPT.app not in /Applications"
  fi

  echo
  echo "=== running processes of interest ==="
  ps -axo pid=,comm= | grep -iE 'chatgpt|openai|clash|verge|mihomo|wireguard|shadowrocket|tailscale|wg-quick' | grep -v grep || true

  echo
  echo "=== wg show (no dump/showconf) ==="
  if command -v wg >/dev/null 2>&1; then
    if sudo -n wg show >/dev/null 2>&1; then
      sudo -n wg show
      sudo -n wg show all public-key || true
      sudo -n wg show all latest-handshakes || true
      sudo -n wg show all transfer || true
      sudo -n wg show all allowed-ips || true
      sudo -n wg show all endpoints || true
    elif wg show >/dev/null 2>&1; then
      wg show
      wg show all public-key || true
      wg show all latest-handshakes || true
      wg show all transfer || true
      wg show all allowed-ips || true
      wg show all endpoints || true
    else
      echo "wg show needs interactive sudo or no interfaces are up"
    fi
  else
    echo "wg not installed"
  fi

  echo
  echo "=== PublicKey lines and derived interface pubkeys ==="
  for d in /etc/wireguard /usr/local/etc/wireguard /opt/homebrew/etc/wireguard "$HOME/.config/wireguard" "$HOME/Library/Application Support/WireGuard"; do
    [[ -d "$d" ]] || continue
    echo "-- $d --"
    find "$d" -maxdepth 2 -name '*.conf' -print 2>/dev/null | while read -r conf; do
      echo "file=$conf"
      grep -E '^[[:space:]]*PublicKey' "$conf" 2>/dev/null | sed 's/^/  /' || true
      echo "  derived_interface_pubkey=$(derive_pubkey "$conf")"
      echo "  $(psk_fingerprint "$conf")"
    done
  done

  echo
  echo "=== recorded pubkey check (programmatic) ==="
  echo "expected_server_iface_pubkey=sRCHVw+s4atumhQ337oC6Yz1lM6dFqCdTpsTt8vqh3g="
  echo "transcribed_mac_pubkey=U6W7IUy/F63dAQ/c6umCxfDX2teldh0ZfHI2rT06TFc= (may be I/l/0/O misread)"

  echo
  echo "=== dns ==="
  scutil --dns 2>/dev/null | awk 'NR<=80'
} >> "$REPORT" 2>&1

echo "READY $REPORT"
echo "No PrivateKey/PSK/password content was written. Upload this file only over existing SSH if needed."
