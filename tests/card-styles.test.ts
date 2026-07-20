import { describe, it, expect } from 'vitest';
import { cardStyles } from '../src/styles';

// Contract / regression guard for the --wac-* surface-theming tokens
// (issue #215). These assertions pin each token's fallback to the exact
// literal that was hardcoded before the token retarget, so the opaque-theme
// render stays byte-identical and the compounding fix cannot silently regress.
describe('cardStyles surface tokens', () => {
  const css = cardStyles.cssText;

  it('routes each themeable surface declaration through a --wac-* token with its prior default', () => {
    // Full-layout .alert-card (steps 1–5)
    expect(css).toContain('var(--wac-alert-background, transparent)');
    expect(css).toContain('var(--wac-alert-border-radius, 12px)');
    expect(css).toContain('var(--wac-alert-border, 1px solid var(--divider-color))');
    expect(css).toContain('var(--wac-alert-shadow, var(--ha-card-box-shadow, 0 2px 5px rgba(0,0,0,0.1)))');
    expect(css).toContain('var(--wac-alert-gap, 16px)');

    // Compact-layout overrides — same tokens, site-specific fallbacks (step 6)
    expect(css).toContain('var(--wac-alert-gap, 4px)');
    expect(css).toContain('var(--wac-alert-border-radius, 8px)');

    // Outer ha-card surface (step 7)
    expect(css).toContain('var(--wac-card-background, var(--ha-card-background, var(--card-background-color)))');
  });

  it('no longer paints the inner alert body with the opaque card background', () => {
    // The pre-change literal must be gone: an opaque inner fill over the
    // painted outer surface is exactly the compounding bug #215 removes.
    expect(css).not.toContain('background: var(--card-background-color);');
  });

  it('resets the trailing gap on the last compact chip', () => {
    // The generic `.alert-card:last-child { margin-bottom: 0 }` reset has equal
    // specificity to `.compact .alert-card` and loses on source order, so
    // compact needs its own last-child reset or the last chip keeps a stray
    // --wac-alert-gap. Guard it: this rule is easy to drop when reordering.
    expect(css).toContain('.compact .alert-card:last-child');
  });
});

// Guard for the configurable per-phase decoration refactor: decoration is now
// carried by phase-independent .deco-* classes + per-phase --wac-flow, so the
// default rendering must resolve byte-identically to the former phase-coupled
// rules.
describe('cardStyles progress decorations', () => {
  const css = cardStyles.cssText;

  it('defines each pattern class for both full and compact fills', () => {
    for (const pattern of ['solid', 'striped', 'shimmer', 'pulse']) {
      // Full-mode selector (.deco-x .progress-fill)
      expect(css).toContain(`.deco-${pattern} .progress-fill`);
      // Compact-mode selector (.compact .deco-x.alert-card::before)
      expect(css).toContain(`.compact .deco-${pattern}.alert-card::before`);
    }
  });

  it('retires the direction-specific stripe keyframes for one parametrized march', () => {
    expect(css).not.toContain('stripe-march-sm');
    expect(css).not.toContain('stripe-march-lg');
    expect(css).toContain('@keyframes stripe-march');
    // The march reads the phase's flow sign and tile size.
    expect(css).toContain('var(--wac-flow, 1) * var(--wac-stripe-tile, 24px)');
  });

  it('pins the per-phase flow direction (preparation flows left, active/ongoing right)', () => {
    // preparation is the only phase that reverses (--wac-flow: -1); active and
    // ongoing use the default +1, so a reassigned texture marches with the bar.
    expect(css).toContain('.preparation .progress-fill');
    expect(css).toMatch(/\.preparation \.progress-fill\s*{[^}]*--wac-flow:\s*-1/);
    expect(css).toMatch(/\.compact \.preparation\.alert-card::before\s*{[^}]*--wac-flow:\s*-1/);
  });

  it('gives every configurable phase a filled base so solid/shimmer are visible', () => {
    // Regression: preparation was transparent (tuned for its default striped
    // look), which made solid/shimmer render invisibly. Every configurable phase
    // now fills with the progress color; striped is the one decoration that
    // clears the fill (see the barber-pole test).
    expect(css).toMatch(/\.preparation \.progress-fill\s*{[^}]*background-color:\s*var\(--wac-progress-fg\)/);
    expect(css).toMatch(/\.active \.progress-fill\s*{[^}]*background-color:\s*var\(--wac-progress-fg\)/);
  });

  it('renders striped as a barber pole (color stripes on an empty track) in every phase', () => {
    // Regression: striped-on-active first drew same-color stripes over a
    // same-color fill (invisible), then a white highlight that washed out the
    // event color. Striped now always clears the fill and paints stripes in the
    // progress color — no highlight anywhere.
    expect(css).toMatch(/\.deco-striped \.progress-fill\s*{[^}]*background-color:\s*transparent/);
    expect(css).toContain('.compact .active.deco-striped.alert-card::before');
    expect(css).toContain('.compact .ongoing.deco-striped.alert-card::before');
    expect(css).toContain('.compact .preparation.deco-striped.alert-card::before');
    // The former white-highlight stripe paint must be gone.
    expect(css).not.toContain('rgba(255, 255, 255, 0.35)');
    // Stripe bands are the progress color everywhere; the --wac-stripe-paint
    // indirection (once used to pre-tint compact preparation) is gone.
    expect(css).not.toContain('--wac-stripe-paint');
    expect(css).toMatch(/\.deco-striped \.progress-fill,\s*\.compact \.deco-striped\.alert-card::before\s*{[^}]*var\(--wac-progress-fg\) 25%/);
  });

  it('renders every phase at full opacity (dimness is not a phase cue)', () => {
    // Preparation no longer dims its fill (was opacity: 0.6), and the ongoing
    // fill no longer carries an inline dim — phase is read from motion/labels,
    // not brightness. (The .expired *card* still fades via a separate rule.)
    expect(css).not.toMatch(/\.preparation \.progress-fill\s*{[^}]*opacity/);
    expect(css).not.toMatch(/\.progress-fill\s*{[^}]*opacity:\s*0\.8/);
  });

  it('pulses the ongoing bar from full progress color (matches active brightness)', () => {
    // The ongoing-pulse breathe now peaks at the solid progress color rather
    // than a dimmed color-mix, so ongoing is never fainter than active.
    expect(css).toMatch(/@keyframes ongoing-pulse\s*{[^}]*0%\s*{\s*background:\s*var\(--wac-progress-fg\)\s*;\s*}/);
  });

  it('keeps the expired fill as a fixed dimmed solid bar (no deco class)', () => {
    expect(css).toContain('.expired .progress-fill');
    expect(css).toMatch(/\.expired \.progress-fill\s*{\s*background-color:\s*var\(--divider-color\)/);
  });

  it('adds per-phase icon-ring border-style overrides', () => {
    expect(css).toContain('.icon-border-dashed .icon-box');
    expect(css).toContain('.icon-border-solid .icon-box');
    // The default preparation dashed ring is retained.
    expect(css).toContain('.preparation .icon-box');
  });

  it('freezes the shimmer sweep by decoration class when animations are off', () => {
    // Retargeted from .active to .deco-shimmer so the freeze follows the pattern
    // into any phase it is placed in.
    expect(css).toContain('.no-animations .deco-shimmer .progress-fill');
    expect(css).toContain('.no-animations.compact .deco-shimmer.alert-card::before');
  });
});

// Guard for the whole-row progress wash (progressFill: background). The wash is
// a low-opacity surface behind content (#215 legibility), so these pin the
// tokens, the per-layout fill elements, the expired dim, the hidden track, and
// the content z-index lift.
describe('cardStyles progress-fill wash', () => {
  const css = cardStyles.cssText;

  it('defines the three --wac-progress-fill-* tokens with their defaults', () => {
    expect(css).toContain('--wac-progress-fill-color: var(--wac-progress-fg)');
    expect(css).toContain('--wac-progress-fill-opacity: 0.10');
    expect(css).toContain('--wac-progress-fill-expired-opacity: 0.06');
    // Dark themes lift the wash strength.
    expect(css).toMatch(/\[data-theme-mode="dark"\] \.alert-card\s*{[^}]*--wac-progress-fill-opacity:\s*0\.14/);
  });

  it('paints a full-height wash behind content in both layouts, positioned by --progress', () => {
    // Full mode uses ::after (::before is the 6px accent bar); compact grows its
    // existing ::before fill. Both sit at z-index:0 with the low-opacity token.
    expect(css).toContain('.fill-mode-background:not(.compact) .alert-card::after');
    expect(css).toMatch(/\.fill-mode-background:not\(\.compact\) \.alert-card::after\s*{[^}]*left:\s*var\(--progress, 0%\)/);
    expect(css).toMatch(/\.fill-mode-background:not\(\.compact\) \.alert-card::after\s*{[^}]*opacity:\s*var\(--wac-progress-fill-opacity\)/);
    expect(css).toContain('.fill-mode-background.compact .alert-card::before');
    expect(css).toMatch(/\.fill-mode-background\.compact \.alert-card::before\s*{[^}]*top:\s*0/);
  });

  it('dims the expired wash to its own token in both layouts', () => {
    expect(css).toMatch(/\.fill-mode-background:not\(\.compact\) \.expired\.alert-card::after\s*{[^}]*opacity:\s*var\(--wac-progress-fill-expired-opacity\)/);
    expect(css).toMatch(/\.fill-mode-background\.compact \.expired\.alert-card::before\s*{[^}]*opacity:\s*var\(--wac-progress-fill-expired-opacity\)/);
  });

  it('hides the redundant thin track and grey base when the wash is on', () => {
    expect(css).toMatch(/\.fill-mode-background \.progress-track\s*{\s*display:\s*none/);
    expect(css).toMatch(/\.fill-mode-background\.compact \.alert-card::after\s*{\s*display:\s*none/);
  });

  it('lifts content wrappers above the z-index:0 wash', () => {
    expect(css).toMatch(/\.fill-mode-background \.alert-header-row[\s\S]*?z-index:\s*1/);
    expect(css).toContain('.fill-mode-background .progress-section');
    expect(css).toContain('.fill-mode-background .alert-details-section');
  });

  it('leaves the default track-mode rules untouched', () => {
    // The wash is strictly additive: the thin track and its fill still exist.
    expect(css).toContain('.progress-track');
    expect(css).toContain('.progress-fill');
  });
});
