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

RESUMING=false

if [ "$DRY_RUN" = false ]; then
  BASE_REF="HEAD"

  if [[ "$CURRENT_BRANCH" =~ ^release/v(.+)$ ]]; then
    RESUMING=true
    RESUME_VERSION="${BASH_REMATCH[1]}"
    echo "Resuming release $RESUME_VERSION from existing branch"
  elif [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Releases must be run from main (or a release/* branch for re-runs)"
    exit 1
  fi

  git fetch origin

  if [ "$RESUMING" = false ]; then
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
    npm run screenshot:hero
  fi

else
  BASE_REF="origin/main"
fi

# -------------------------
# Determine version
# -------------------------

if [ "$RESUMING" = true ]; then

  VERSION="$RESUME_VERSION"
  echo "Resuming version: $VERSION"

else

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

fi

# -------------------------
# Determine cliff flags for note generation
# GA releases ignore prerelease tags to collapse alpha/beta/rc into one section
# -------------------------

CLIFF_FLAGS=()

if [[ ! "$VERSION" =~ -(alpha|beta|rc)\. ]]; then
  CLIFF_FLAGS+=(--tag-pattern "^v[0-9]+\.[0-9]+\.[0-9]+$")
fi

# -------------------------
# Dry-run preview
# -------------------------

if [ "$DRY_RUN" = true ]; then

  echo ""
  echo "---- SIMULATED RELEASE FROM origin/main ----"

  npx git-cliff \
    --config cliff.toml \
    --tag "v$VERSION" \
    "${CLIFF_FLAGS[@]}" \
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
# Create or switch to branch
# -------------------------

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Branch $BRANCH already exists, switching to it"
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH"
fi

# -------------------------
# Update version
# -------------------------

if [ "$(node -p "require('./package.json').version")" != "$VERSION" ]; then
  npm version "$VERSION" --no-git-tag-version
else
  echo "Version already at $VERSION, skipping bump"
fi

# -------------------------
# Generate changelog
# -------------------------

npx git-cliff --config cliff.toml --tag "v$VERSION" "${CLIFF_FLAGS[@]}" --output CHANGELOG.md

git add CHANGELOG.md package.json package-lock.json img/

if git diff --cached --quiet; then
  echo "Nothing to commit, skipping"
else
  git commit -m "chore: release v$VERSION"
fi

# -------------------------
# Push branch
# -------------------------

if git rev-parse --verify --quiet "refs/remotes/origin/$BRANCH" >/dev/null 2>&1 \
   && git diff --quiet "$BRANCH" "origin/$BRANCH"; then
  echo "Branch already pushed and up to date, skipping push"
else
  git push -u origin "$BRANCH"
fi

# -------------------------
# Create PR
# -------------------------

NOTES=$(npx git-cliff \
  --config cliff.toml \
  --tag "v$VERSION" \
  "${CLIFF_FLAGS[@]}" \
  --unreleased \
  --strip header)

EXISTING_PR=$(gh pr list --head "$BRANCH" --base main --json number --jq '.[0].number // empty' 2>/dev/null || true)

if [ -n "$EXISTING_PR" ]; then
  echo "PR #$EXISTING_PR already exists, updating body"
  gh pr edit "$EXISTING_PR" --body "$NOTES"
else
  gh pr create \
    --title "chore: release v$VERSION" \
    --body "$NOTES" \
    --base main \
    --head "$BRANCH"
fi

echo ""
echo "PR created for v$VERSION"
echo ""
echo "After merge run:"
echo "scripts/publish.sh $VERSION"
