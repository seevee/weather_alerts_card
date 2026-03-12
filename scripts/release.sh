#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
PRERELEASE=""
BUMP=""

# -------------------------
# Parse args
# -------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --alpha | --beta | --rc)
      PRERELEASE="${1#--}"
      shift
      ;;
    major | minor | patch)
      BUMP="$1"
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Release pipeline starting"
echo "Current branch: $CURRENT_BRANCH"
echo "Dry run: $DRY_RUN"
echo "Prerelease: ${PRERELEASE:-none}"

git fetch origin
git fetch --tags origin

# -------------------------
# Strict checks ONLY for real releases
# -------------------------

if [ "$DRY_RUN" = false ]; then
  BASE_REF="HEAD"

  if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Releases must be run from main"
    exit 1
  fi

  git fetch origin

  if ! git diff --quiet; then
    echo "Working tree not clean"
    exit 1
  fi

  if ! git diff --quiet main origin/main; then
    echo "Local main not synced with origin/main"
    exit 1
  fi

  npm run lint
  npm run test

else
  BASE_REF="origin/main"
fi

# -------------------------
# Determine bump
# -------------------------

if [ -z "$BUMP" ]; then
  BUMP=$(git log $(git describe --tags --abbrev=0 "$BASE_REF").."$BASE_REF" \
        --pretty=%s \
        | npx conventional-recommended-bump -p angular \
        | grep -Eo 'major|minor|patch' \
        | head -n1)
fi

CURRENT=$(node -p "require('./package.json').version")

LATEST_TAG=$(git describe --tags --abbrev=0 "$BASE_REF" 2>/dev/null || echo "")

PROMOTE=false
BASE_FROM_PRERELEASE=""

if [[ "$LATEST_TAG" =~ ^v([0-9]+\.[0-9]+\.[0-9]+)-(alpha|beta|rc)\.[0-9]+$ ]]; then

  BASE_FROM_PRERELEASE="${BASH_REMATCH[1]}"

  COMMITS_AFTER=$(git rev-list "$LATEST_TAG"..$BASE_REF --count)

  if [ "$COMMITS_AFTER" -eq 0 ]; then
    PROMOTE=true
  fi

fi

# -------------------------
# Compute version
# -------------------------

if [ "$PROMOTE" = true ]; then

  VERSION="$BASE_FROM_PRERELEASE"
  echo "Promoting prerelease $LATEST_TAG → v$VERSION"

elif [ -n "$PRERELEASE" ]; then

  BASE=$(npx semver "$CURRENT" -i "$BUMP")

  EXISTING=$(git tag -l "v$BASE-$PRERELEASE.*" | wc -l | tr -d ' ')

  NEXT=$((EXISTING + 1))

  VERSION="$BASE-$PRERELEASE.$NEXT"

else

  VERSION=$(npx semver "$CURRENT" -i "$BUMP")

fi

echo "Current version: $CURRENT"
echo "Next version: $VERSION"

# -------------------------
# Dry-run preview
# -------------------------

if [ "$DRY_RUN" = true ]; then

  echo ""
  echo "---- SIMULATED RELEASE FROM origin/main ----"

  npx git-cliff \
    --config .cliff.toml \
    --tag "v$VERSION" \
    --unreleased \
    --strip header \
    "$BASE_REF"

  echo ""
  echo "Next tag: v$VERSION"
  echo "Branch would be: release/v$VERSION"
  echo "Dry run complete"

  exit 0

fi

BRANCH="release/v$VERSION"

# -------------------------
# Create branch
# -------------------------

git checkout -b "$BRANCH"

# -------------------------
# Update version
# -------------------------

npm version "$VERSION" --no-git-tag-version

# -------------------------
# Generate changelog
# -------------------------

npx git-cliff --config .cliff.toml --tag "v$VERSION" --output CHANGELOG.md

git add CHANGELOG.md package.json package-lock.json

# -------------------------
# Build
# -------------------------

npm run build

git add dist

git commit -m "chore: release v$VERSION"

git push -u origin "$BRANCH"

# -------------------------
# Create PR
# -------------------------

NOTES=$(npx git-cliff \
  --config .cliff.toml \
  --tag "v$VERSION" \
  --unreleased \
  --strip header)

gh pr create \
  --title "chore: release v$VERSION" \
  --body "$NOTES" \
  --base main \
  --head "$BRANCH"

echo ""
echo "PR created for v$VERSION"
echo ""
echo "After merge run:"
echo "scripts/publish.sh $VERSION"
