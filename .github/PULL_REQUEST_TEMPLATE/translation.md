## Locale

<!-- The language, and the Home Assistant locale code you used as the filename.
     e.g. Simplified Chinese — zh-Hans -->

## Checklist

- [ ] Copied from `src/translations/en.ts`, with the keys left exactly as they are
- [ ] Registered the locale in `src/translations/index.ts`
- [ ] `{placeholder}` tokens kept intact and spelled the same as in English

## Notes

<!-- Anything you were unsure about, or strings that don't carry over cleanly.
     Partial translations are welcome — any key you leave out falls back to
     English, so an incomplete locale is still worth having. -->

---

No need to run the build or the tests for a translation-only change — CI runs them
here, and `tests/localize.test.ts` reports any key or placeholder drift directly on
the pull request.
