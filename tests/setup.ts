import { afterEach } from 'vitest';

// Suite-wide teardown: force-disconnect every custom element a test mounted.
//
// The card subscribes to a *global* `window` event in connectedCallback (the
// dismissal-change bus) and unsubscribes in disconnectedCallback. Tests share
// one `window` across every `it()` in a file (a vmThreads context on jsdom,
// the tester iframe in Chromium), so a card that lingers past a test — a
// forgotten `cleanup()`, or an async assertion that throws before teardown —
// keeps a live, scope-matched listener registered. The next test
// using the same dismissal scope (e.g. the same `device:` id) then sees that
// stale card reload `_dismissals` from storage at an unpredictable moment.
//
// That cross-test bleed only surfaces under full-suite timing, never in
// isolation — exactly the profile of the intermittent device-mode dismissal
// failure. Clearing the document between tests triggers disconnectedCallback on
// every mounted element, tearing down its global listeners deterministically.
// Storage is per origin, so in the browser project every file and every
// test sees the same localStorage. Clear it too: the dismissal suites key
// their records on config-derived scope hashes that repeat across files.
afterEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
});
