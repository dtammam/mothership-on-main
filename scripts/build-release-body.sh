#!/usr/bin/env bash
# Bash equivalent of build-release-body.ps1 — generates release notes markdown.
set -euo pipefail

OUTPUT_DIR="${1:-dist/edge-packages}"
PROGRESS_ENTRIES="${2:-1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MANIFEST_PATH="$REPO_ROOT/manifest.json"
PROGRESS_PATH="$REPO_ROOT/PROGRESS.md"
RESOLVED_OUTPUT_DIR="$REPO_ROOT/$OUTPUT_DIR"
CHECKSUMS_PATH="$RESOLVED_OUTPUT_DIR/checksums.txt"

if [[ ! -f "$MANIFEST_PATH" ]]; then
    echo "Error: manifest.json not found at repository root." >&2
    exit 1
fi
if [[ ! -f "$CHECKSUMS_PATH" ]]; then
    echo "Error: checksums.txt not found. Run package-edge.sh first." >&2
    exit 1
fi
if [[ ! -f "$PROGRESS_PATH" ]]; then
    echo "Error: PROGRESS.md not found at repository root." >&2
    exit 1
fi
if [[ "$PROGRESS_ENTRIES" -lt 1 ]]; then
    echo "Error: PROGRESS_ENTRIES must be at least 1." >&2
    exit 1
fi

VERSION="$(python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['version'])" "$MANIFEST_PATH" 2>/dev/null \
    || node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).version)" "$MANIFEST_PATH")"
if [[ -z "$VERSION" ]]; then
    echo "Error: manifest.json is missing a valid version value." >&2
    exit 1
fi

SHA_LINES="$(grep -v '^[[:space:]]*$' "$CHECKSUMS_PATH")"

# Extract timestamped progress entries (lines matching YYYY-MM-DD HH:MM - ...)
PROGRESS_LINES="$(grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}[[:space:]]+[0-9]{2}:[0-9]{2}[[:space:]]+-[[:space:]]+' "$PROGRESS_PATH" || true)"
RECENT_PROGRESS="$(echo "$PROGRESS_LINES" | tail -n "$PROGRESS_ENTRIES")"

SHORT_SHA="${GITHUB_SHA:+${GITHUB_SHA:0:7}}"
SHORT_SHA="${SHORT_SHA:-local}"
RUN_NUMBER="${GITHUB_RUN_NUMBER:-local}"
BUILD_DATE="$(date -u '+%Y-%m-%d %H:%M:%S')"

RELEASE_BODY_PATH="$RESOLVED_OUTPUT_DIR/release-body.md"

{
    echo "# Mothership on Main build metadata"
    echo ""
    echo "- Manifest version: v$VERSION"
    echo "- Commit: $SHORT_SHA"
    echo "- Run: $RUN_NUMBER"
    echo "- Built (UTC): $BUILD_DATE"
    echo ""
    echo "## SHA-256 checksums"
    echo ""
    echo '```text'
    echo "$SHA_LINES"
    echo '```'
    echo ""
    echo "## Release notes"
    echo ""
    if [[ -z "$RECENT_PROGRESS" ]]; then
        echo '- No timestamped progress entries were found in `PROGRESS.md`.'
    else
        while IFS= read -r line; do
            [[ -n "$line" ]] && echo "- $line"
        done <<< "$RECENT_PROGRESS"
    fi
} > "$RELEASE_BODY_PATH"

# Write GitHub Actions outputs if available
if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "manifest_version=$VERSION" >> "$GITHUB_OUTPUT"
    echo "short_sha=$SHORT_SHA" >> "$GITHUB_OUTPUT"
    echo "release_body_path=$RELEASE_BODY_PATH" >> "$GITHUB_OUTPUT"
fi

echo "Release body generated at $RELEASE_BODY_PATH"
