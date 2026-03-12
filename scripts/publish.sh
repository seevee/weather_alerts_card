#!/usr/bin/env bash
set -euo pipefail

VERSION=$1
TAG="v$VERSION"

git checkout main
git pull origin main

git tag "$TAG"
git push origin "$TAG"

NOTES=$(git cliff \
  --config .cliff.toml \
  --tag "$TAG" \
  --strip header)

PRERELEASE=false

if [[ "$VERSION" == *"-alpha"* || "$VERSION" == *"-beta"* || "$VERSION" == *"-rc"* ]]; then
  PRERELEASE=true
fi

gh release create "$TAG" \
  --title "$TAG" \
  --notes "$NOTES" \
  $([ "$PRERELEASE" = true ] && echo "--prerelease")

echo "Release $TAG published"
