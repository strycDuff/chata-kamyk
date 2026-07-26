#!/usr/bin/env bash
# Deploy static site to Cloudflare Pages (excludes .tools / .git / docs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
rsync -a \
  --exclude '.git' \
  --exclude '.tools' \
  --exclude '.wrangler' \
  --exclude 'docs' \
  --exclude '.DS_Store' \
  --exclude '.cursor' \
  --exclude 'scripts' \
  ./ "$tmpdir/"
export NODE_TLS_REJECT_UNAUTHORIZED="${NODE_TLS_REJECT_UNAUTHORIZED:-0}"
npx --yes wrangler pages deploy "$tmpdir" \
  --project-name=chata-kamyk \
  --commit-dirty=true \
  --commit-hash="$(git rev-parse HEAD)" \
  --commit-message="$(git log -1 --pretty=%s)"
