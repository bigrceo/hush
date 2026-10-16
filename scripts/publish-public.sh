#!/usr/bin/env bash
# Exports a clean copy of this repo to the public GitHub repo, with no private history and no secrets.
#   scripts/publish-public.sh            # export + secret scan only (dry run), prints the export dir
#   scripts/publish-public.sh --push     # also commit and push to the `public` remote (github.com/bigrceo/hush)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${HUSH_EXPORT_DIR:-$(mktemp -d)/hush}"
REMOTE_URL="${HUSH_PUBLIC_URL:-https://github.com/bigrceo/hush.git}"

EXCLUDE_RE='^(x-launch-pack/|screenshots/|skills-lock\.json$|\.secrets|\.env($|\.)|\.agents/|\.claude/|\.vercel/|\.wrangler/|\.open-next/|CLAUDE\.md$|AGENTS\.md$)'
mkdir -p "$OUT"
cd "$ROOT"
git ls-files -co --exclude-standard | grep -Ev "$EXCLUDE_RE" | grep -v '\.env\.example$' > /tmp/hush-export-list.$$ || true
echo ".env.example" >> /tmp/hush-export-list.$$
rsync -a --files-from=/tmp/hush-export-list.$$ "$ROOT/" "$OUT/"
rm -f /tmp/hush-export-list.$$

# Secret scan: abort on anything that looks like a credential.
PATTERNS='(api[-_]?key\s*[=:]\s*["'"'"']?[A-Za-z0-9_-]{16,}|postgres(ql)?://[^ "'"'"'<]*@|npg_[A-Za-z0-9]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY|\[([0-9]{1,3}, *){63}[0-9]{1,3}\]|(HUSH|CRON)_SECRET\s*=\s*["'"'"']?[A-Za-z0-9+/_-]{24,}|helius-rpc\.com/\?api-key=|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,})'
if grep -rInE "$PATTERNS" "$OUT" --exclude-dir=node_modules; then
  echo "ABORT: possible secret found in export ($OUT)" >&2
  exit 1
fi
# Also refuse any literal value from local env files (.env.local, .secrets) appearing in the export.
for envf in "$ROOT/.env.local" "$ROOT/.secrets"; do
  [ -f "$envf" ] || continue
  while IFS= read -r line; do
    v="${line#*=}"; v="${v%\"}"; v="${v#\"}"
    [ ${#v} -ge 12 ] || continue
    if grep -rqF -- "$v" "$OUT"; then echo "ABORT: a value from $(basename "$envf") appears in the export" >&2; exit 1; fi
  done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$envf" 2>/dev/null || true)
done
for f in .env .env.local .secrets; do [ -e "$OUT/$f" ] && { echo "ABORT: $f in export" >&2; exit 1; }; done
echo "export clean: $OUT ($(find "$OUT" -type f | wc -l | tr -d ' ') files)"

[ "${1:-}" = "--push" ] || exit 0
SRC_SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
WORK="$(mktemp -d)/pub"
if git ls-remote "$REMOTE_URL" >/dev/null 2>&1 && [ -n "$(git ls-remote "$REMOTE_URL" main)" ]; then
  git clone -q --depth 1 "$REMOTE_URL" "$WORK"
  find "$WORK" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
  rsync -a "$OUT/" "$WORK/"
  git -C "$WORK" add -A
  git -C "$WORK" diff --cached --quiet && { echo "public repo already up to date"; exit 0; }
  git -C "$WORK" commit -qm "Sync from private tree ($SRC_SHA)"
else
  mkdir -p "$WORK" && rsync -a "$OUT/" "$WORK/"
  git -C "$WORK" init -q -b main
  git -C "$WORK" add -A
  git -C "$WORK" commit -qm "HUSH: private x402 payments for AI agents on Solana"
  git -C "$WORK" remote add origin "$REMOTE_URL"
fi
git -C "$WORK" push -q origin main
echo "pushed to $REMOTE_URL"
