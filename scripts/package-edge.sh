#!/usr/bin/env bash
# Bash equivalent of package-edge.ps1 — creates prod and QA edge extension zips.
set -euo pipefail

OUTPUT_DIR="${1:-dist/edge-packages}"
QA_SUFFIX="${2:- QA}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_PATH="$REPO_ROOT/manifest.json"

if [[ ! -f "$MANIFEST_PATH" ]]; then
    echo "Error: manifest.json not found at repository root." >&2
    exit 1
fi

EXTENSION_NAME="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['name'])" "$MANIFEST_PATH" 2>/dev/null \
    || node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).name)" "$MANIFEST_PATH")"
VERSION="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$MANIFEST_PATH" 2>/dev/null \
    || node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version)" "$MANIFEST_PATH")"

if [[ -z "$EXTENSION_NAME" ]]; then
    echo "Error: manifest.json is missing a valid name value." >&2
    exit 1
fi
if [[ -z "$VERSION" ]]; then
    echo "Error: manifest.json is missing a valid version value." >&2
    exit 1
fi

SLUG="$(echo "$EXTENSION_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')"
if [[ -z "$SLUG" ]]; then
    SLUG="edge-extension"
fi

RESOLVED_OUTPUT_DIR="$REPO_ROOT/$OUTPUT_DIR"
mkdir -p "$RESOLVED_OUTPUT_DIR"

STAGING_ROOT="$(mktemp -d)"
PROD_STAGE="$STAGING_ROOT/prod"
QA_STAGE="$STAGING_ROOT/qa"
mkdir -p "$PROD_STAGE" "$QA_STAGE"

# Copies required package items to the destination directory.
copy_package_content() {
    local src_root="$1"
    local dest_root="$2"
    local items=(
        "manifest.json"
        "index.html"
        "config.json"
        "css"
        "js"
        "images"
        "LICENSE"
        "NOTICE"
        "PRIVACY.md"
    )
    for item in "${items[@]}"; do
        local src_path="$src_root/$item"
        if [[ ! -e "$src_path" ]]; then
            echo "Error: Required package item not found: $item" >&2
            exit 1
        fi
        cp -r "$src_path" "$dest_root/"
    done
}

cleanup() {
    rm -rf "$STAGING_ROOT"
}
trap cleanup EXIT

copy_package_content "$REPO_ROOT" "$PROD_STAGE"
copy_package_content "$REPO_ROOT" "$QA_STAGE"

# Append QA suffix to QA manifest name
QA_MANIFEST="$QA_STAGE/manifest.json"
if python3 -c "pass" 2>/dev/null; then
    python3 -c "
import json, sys
path = sys.argv[1]
suffix = sys.argv[2]
with open(path) as f:
    m = json.load(f)
if not m['name'].endswith(suffix):
    m['name'] = m['name'] + suffix
with open(path, 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
" "$QA_MANIFEST" "$QA_SUFFIX"
else
    node -e "
const fs = require('fs');
const path = process.argv[1];
const suffix = process.argv[2];
const m = JSON.parse(fs.readFileSync(path, 'utf8'));
if (!m.name.endsWith(suffix)) m.name = m.name + suffix;
fs.writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
" "$QA_MANIFEST" "$QA_SUFFIX"
fi

PROD_ZIP="$RESOLVED_OUTPUT_DIR/$SLUG-$VERSION-prod.zip"
QA_ZIP="$RESOLVED_OUTPUT_DIR/$SLUG-$VERSION-qa.zip"

rm -f "$PROD_ZIP" "$QA_ZIP" "$PROD_ZIP.sha256" "$QA_ZIP.sha256"

(cd "$PROD_STAGE" && zip -rq "$PROD_ZIP" .)
(cd "$QA_STAGE" && zip -rq "$QA_ZIP" .)

# Generate checksums
CHECKSUMS_FILE="$RESOLVED_OUTPUT_DIR/checksums.txt"
{
    sha256sum "$QA_ZIP" | sed "s|.*/||" | awk '{print $1 "  " $2}'
    sha256sum "$PROD_ZIP" | sed "s|.*/||" | awk '{print $1 "  " $2}'
} > "$CHECKSUMS_FILE"

echo "Created packages:"
echo "  $QA_ZIP"
echo "  $PROD_ZIP"
echo "Checksums written to:"
echo "  $CHECKSUMS_FILE"
