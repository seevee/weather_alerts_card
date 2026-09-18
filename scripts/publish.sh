#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: publish.sh <version> [options]

Options:
  --notes <text>                    Custom notes appended after the changelog
  --new-contributor <user>#<pr>     First-time contributor (repeatable)

Examples:
  ./scripts/publish.sh 2.4.0
  ./scripts/publish.sh 2.4.0 --notes "Thanks to @finity69x2 for the shout-out in nws_alerts v6.6.1!"
  ./scripts/publish.sh 2.4.0 --new-contributor "pkolbus#67" --new-contributor "otheruser#80"
USAGE
  exit 1
}

[[ $# -lt 1 ]] && usage

VERSION=$1; shift
TAG="v$VERSION"

PRERELEASE=false
CUSTOM_NOTES=""
NEW_CONTRIBUTORS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --notes)
      [[ $# -lt 2 ]] && { echo "Error: --notes requires a value"; exit 1; }
      CUSTOM_NOTES="$2"; shift 2 ;;
    --new-contributor)
      [[ $# -lt 2 ]] && { echo "Error: --new-contributor requires a value"; exit 1; }
      NEW_CONTRIBUTORS+=("$2"); shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

if [[ "$VERSION" == *"-alpha"* || "$VERSION" == *"-beta"* || "$VERSION" == *"-rc"* ]]; then
  PRERELEASE=true
fi

git checkout main
git pull origin main

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists locally, skipping"
else
  git tag "$TAG"
fi

if git ls-remote --tags origin "$TAG" | grep -q "$TAG"; then
  echo "Tag $TAG already exists on remote, skipping push"
else
  git push origin "$TAG"
fi

# Generate notes after tag exists so --latest works on re-runs too
# Prerelease: notes for just this tag's commits
# GA release: collapse all commits since last stable tag into one section
if [ "$PRERELEASE" = true ]; then
  NOTES=$(CLIFF_SURFACE=release npx git-cliff \
    --config cliff.toml \
    --latest \
    --strip header)
else
  NOTES=$(CLIFF_SURFACE=release npx git-cliff \
    --config cliff.toml \
    --tag-pattern "^v[0-9]+\.[0-9]+\.[0-9]+$" \
    --latest \
    --strip header)
fi

# The release PR body is the release notes once someone has edited it.
# release.sh seeds that body with the same generated notes, so a body that
# still matches the generation was never touched and the fresh copy ships.
# Anything else, a narrative above the list or an annotated line, ships
# verbatim: the PR is where the notes get reviewed, not the release edit box.
# --notes and --new-contributor still append below whichever body ships.
PR_BODY=$(gh pr list --state merged --base main --head "release/v$VERSION" \
  --json body --jq '.[0].body // empty' 2>/dev/null || true)
PR_BODY=${PR_BODY//$'\r'/}
if [ -n "$PR_BODY" ] && [ "$PR_BODY" != "$NOTES" ]; then
  echo "Using the release PR body as the release notes"
  NOTES="$PR_BODY"
fi

# Append new-contributors section
if [ ${#NEW_CONTRIBUTORS[@]} -gt 0 ]; then
  CONTRIB_SECTION="
## New Contributors"
  for entry in "${NEW_CONTRIBUTORS[@]}"; do
    user="${entry%%#*}"
    pr="${entry#*#}"
    CONTRIB_SECTION="$CONTRIB_SECTION
* @$user made their first contribution in #$pr"
  done
  NOTES="$NOTES
$CONTRIB_SECTION"
fi

# Append custom notes
if [ -n "$CUSTOM_NOTES" ]; then
  NOTES="$NOTES

---

$CUSTOM_NOTES"
fi

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG already exists, skipping"
else
  gh release create "$TAG" \
    --title "$TAG" \
    --notes "$NOTES" \
    $([ "$PRERELEASE" = true ] && echo "--prerelease")
  echo "Release $TAG published"
fi
