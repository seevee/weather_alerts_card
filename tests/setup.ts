import { afterEach } from 'vitest';

// Suite-wide teardown: force-disconnect every custom element a test mounted.
//
// The card subscribes to a *global* `window` event in connectedCallback (the
// dismissal-change bus) and unsubscribes in disconnectedCallback. Tests share
// one jsdom `window` across every `it()` in a file, so a card that lingers past
// a test — a forgotten `cleanup()`, or an async assertion that throws before
// teardown — keeps a live, scope-matched listener registered. The next test
// using the same dismissal scope (e.g. the same `device:` id) then sees that
// stale card reload `_dismissals` from storage at an unpredictable moment.
//
// That cross-test bleed only surfaces under full-suite timing, never in
// isolation — exactly the profile of the intermittent device-mode dismissal
// failure. Clearing the document between tests triggers disconnectedCallback on
// every mounted element, tearing down its global listeners deterministically.
afterEach(() => {
  document.body.innerHTML = '';
});
