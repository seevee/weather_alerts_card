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

# Generate notes before tagging so --unreleased can find the commits
# Prerelease: notes for just this tag's commits
# GA release: collapse all commits since last stable tag into one section
if [ "$PRERELEASE" = true ]; then
  NOTES=$(npx git-cliff \
    --config cliff.toml \
    --tag "$TAG" \
    --unreleased \
    --strip header)
else
  NOTES=$(npx git-cliff \
    --config cliff.toml \
    --tag "$TAG" \
    --tag-pattern "^v[0-9]+\.[0-9]+\.[0-9]+$" \
    --unreleased \
    --strip header)
fi

git tag "$TAG"
git push origin "$TAG"

MIGRATION_NOTICE="
---

<details>
<summary><strong>Migrating from v1.x</strong></summary>

The card was renamed from **NWS Alerts Card** to **Weather Alerts Card** to reflect multi-provider support. Your existing dashboards will continue to work — the old element name is supported but deprecated.

1. Update your dashboard YAML: change \`type: custom:nws-alerts-card\` to \`type: custom:weather-alerts-card\`
2. Update your resource URL:
   - **HACS users:** HACS updates the resource path automatically — no action needed.
   - **Manual install:** In Settings → Dashboards → Resources, change \`/local/nws-alerts-card.js\` to \`/local/weather-alerts-card.js\`
3. The old names will be removed in v3.

</details>"

if [ "$PRERELEASE" = false ]; then
  NOTES="$NOTES
$MIGRATION_NOTICE"
fi

gh release create "$TAG" \
  --title "$TAG" \
  --notes "$NOTES" \
  $([ "$PRERELEASE" = true ] && echo "--prerelease")

echo "Release $TAG published"
