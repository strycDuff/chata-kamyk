#!/usr/bin/env bash
# Stamp APP_BUILD (git commit count) into koupelna/index.html.
# APP_COMMIT is filled at deploy time (avoids self-hash amend loop).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/koupelna/index.html"
BUILD="$(git -C "$ROOT" rev-list --count HEAD)"
python3 - "$FILE" "$BUILD" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
build = sys.argv[2]
text = path.read_text()
m = re.search(r'const APP_VERSION = "([^"]+)"', text)
version = m.group(1) if m else "0.0.0"
pat = re.compile(r"// BUILD_META_START\n.*?// BUILD_META_END", re.S)
block = (
    f"// BUILD_META_START\n"
    f'  const APP_VERSION = "{version}";\n'
    f"  const APP_BUILD = {build};\n"
    f'  const APP_COMMIT = "";\n'
    f"  // BUILD_META_END"
)
new, n = pat.subn(block, text, count=1)
if n != 1:
    raise SystemExit("BUILD_META block not found")
path.write_text(new)
print(f"stamped v{version} build {build}")
PY
