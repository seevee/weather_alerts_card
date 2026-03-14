#!/usr/bin/env bash
set -euo pipefail

VERSION=$1
TAG="v$VERSION"

PRERELEASE=false

if [[ "$VERSION" == *"-alpha"* || "$VERSION" == *"-beta"* || "$VERSION" == *"-rc"* ]]; then
  PRERELEASE=true
fi

git checkout main
git pull origin main

git tag "$TAG"
git push origin "$TAG"

# Prerelease: notes for just this tag's commits
# GA release: collapse all commits since last stable tag into one section
if [ "$PRERELEASE" = true ]; then
  NOTES=$(npx git-cliff \
    --config cliff.toml \
    --latest \
    --strip header)
else
  NOTES=$(npx git-cliff \
    --config cliff.toml \
    --tag "$TAG" \
    --tag-pattern "^v[0-9]+\.[0-9]+\.[0-9]+$" \
    --unreleased \
    --strip header)
fi

gh release create "$TAG" \
  --title "$TAG" \
  --notes "$NOTES" \
  $([ "$PRERELEASE" = true ] && echo "--prerelease")

echo "Release $TAG published"
