# WireGuard / ChatGPT split — handoff

This pack is **not yet executed**. Phase 1 handshake, Phase 2 Clash TUN, and Phase 3 egress checks are unfinished. Shadowrocket has not been touched.

## Why a Cloud Agent cannot finish this

| Side | Status |
| --- | --- |
| MacBook Air | My Machines worker is online (`MacBook Air`, dir `~/Documents/zhixuangu-miniprogram`, `repos` empty). This Cloud VM cannot dispatch shells there. |
| `ai-gateway` | `root@38.244.17.106:34096` offers `password,keyboard-interactive` only. BatchMode SSH from the cloud is denied. Do not put the password in git. |

Without both a Mac shell and server SSH, public keys cannot be program-checked, UDP 51820 cannot be captured on both ends, and WireGuard / Clash credentials cannot be written safely.

## Cloud-only facts (do not treat as handshake proof)

- `38.244.17.106` ICMP works.
- TCP `34096` is open (SSH).
- TCP `51820` is refused (consistent with UDP-only WireGuard).
- Invalid UDP `51820` probes get no reply — **not** evidence of a block.
- Not done: `wg show`, both-end pubkey compare, INPUT/FORWARD/nft/NAT, ≥45s dual capture, `10.66.66.1` reachability.

Recorded keys to re-read on the Mac (do not re-type from screenshots):

- Server interface public key should be `sRCHVw+s4atumhQ337oC6Yz1lM6dFqCdTpsTt8vqh3g=`
- `mac-new` was transcribed as `U6W7IUy/F63dAQ/c6umCxfDX2teldh0ZfHI2rT06TFc=` and may be an I/l/0/O misread

## Files

| Path | Role |
| --- | --- |
| `scripts/run-on-mac.sh` | Darwin-only readonly snapshot. Derives interface pubkey with `wg pubkey` without printing the private key. Refuses on Linux. |
| `scripts/check-openai-split-template.sh` | CI/local check: placeholder key, `MATCH,DIRECT`, endpoint DIRECT, no shared CDN. |
| `clash/openai-split.template.yaml` | Mihomo TUN + rule mode. Inject `private-key` from verified `mac-new` into a `*.local.yaml` that is gitignored. |

## How to continue (pick one)

1. **Recommended:** In Cursor, open an Agent whose environment is **MacBook Air** (not this hosted Linux VM) and send the original three-phase task. Do not bind this GitHub repo if the worker rejects a repo mismatch.
2. If the picker says the worker is tied to another repo: start the worker in this project directory, or point `--worker-dir` at this checkout, then resend.
3. Server-only login from a Cloud Agent still cannot finish Clash or ChatGPT app checks.

Do **not** re-run the same cloud diagnostics. They cannot add handshake evidence.

## After a Mac agent finishes Phase 3 (target state, not active now)

Daily on/off and one-click rollback are meaningless until handshake + split are verified.

- **On:** Clash Verge Rev rule mode + TUN; native `mac-new` tunnel off.
- **Off / direct:** disable TUN (or exit Clash). Default traffic stays `MATCH,DIRECT`.
- **Rollback native WG:** restore the pre-change `mac-new` backup; keep `AllowedIPs` as `10.66.66.0/24` until handshake is proven.
- **Shadowrocket:** leave its profile untouched; it is the recovery path if Clash or native WG breaks reachability.

## Security

- Never print `PrivateKey`, PSK, or passwords in chat, logs, or git.
- Never run `wg show dump` or `wg showconf`.
- Do not generate new keys, delete peers, or flush firewalls unless evidence requires a specific change.
- Native WireGuard tests must not use `AllowedIPs = 0.0.0.0/0`.
