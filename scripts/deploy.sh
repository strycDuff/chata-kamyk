#!/usr/bin/env bash
# Deploy static site to Cloudflare Pages (excludes .tools / .git / docs).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BUILD="$(git rev-list --count HEAD)"
COMMIT="$(git rev-parse --short HEAD)"
VERSION="$(python3 - <<PY
import pathlib, re
text = pathlib.Path("koupelna/index.html").read_text()
m = re.search(r'const APP_VERSION = "([^"]+)"', text)
print(m.group(1) if m else "0.0.0")
PY
)"
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
python3 - "$tmpdir/koupelna/index.html" "$VERSION" "$BUILD" "$COMMIT" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
version, build, commit = sys.argv[2], sys.argv[3], sys.argv[4]
text = path.read_text()
pat = re.compile(r"// BUILD_META_START\n.*?// BUILD_META_END", re.S)
block = (
    f"// BUILD_META_START\n"
    f'  const APP_VERSION = "{version}";\n'
    f"  const APP_BUILD = {build};\n"
    f'  const APP_COMMIT = "{commit}";\n'
    f"  // BUILD_META_END"
)
new, n = pat.subn(block, text, count=1)
if n != 1:
    raise SystemExit("BUILD_META block not found in deploy copy")
path.write_text(new)
print(f"deploy stamp v{version} build {build} ({commit})")
PY
export NODE_TLS_REJECT_UNAUTHORIZED="${NODE_TLS_REJECT_UNAUTHORIZED:-0}"
npx --yes wrangler pages deploy "$tmpdir" \
  --project-name=chata-kamyk \
  --commit-dirty=true \
  --commit-hash="$(git rev-parse HEAD)" \
  --commit-message="$(git log -1 --pretty=%s)"
