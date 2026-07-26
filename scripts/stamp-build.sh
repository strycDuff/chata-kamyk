#!/usr/bin/env bash
# Stamp APP_BUILD / APP_COMMIT into koupelna/index.html from current git HEAD.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$ROOT/koupelna/index.html"
BUILD="$(git -C "$ROOT" rev-list --count HEAD)"
COMMIT="$(git -C "$ROOT" rev-parse --short HEAD)"
python3 - "$FILE" "$BUILD" "$COMMIT" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
build, commit = sys.argv[2], sys.argv[3]
text = path.read_text()
pat = re.compile(
    r"// BUILD_META_START\n.*?// BUILD_META_END",
    re.S,
)
block = (
    f"// BUILD_META_START\n"
    f'  const APP_VERSION = "3.1.0";\n'
    f"  const APP_BUILD = {build};\n"
    f'  const APP_COMMIT = "{commit}";\n'
    f"  // BUILD_META_END"
)
new, n = pat.subn(block, text, count=1)
if n != 1:
    raise SystemExit("BUILD_META block not found in koupelna/index.html")
path.write_text(new)
print(f"stamped v3.1.0 build {build} ({commit})")
PY
