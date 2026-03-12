# Release

Run the release pipeline.

Usage: `/release [major|minor|patch]`

Execute:

```
scripts/release.sh $ARGUMENTS
```

After the PR merges, run:

```
scripts/publish.sh <version>
```
