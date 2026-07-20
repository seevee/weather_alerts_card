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
    // now fills with the progress color; only preparation+striped clears it.
    expect(css).toMatch(/\.preparation \.progress-fill\s*{[^}]*background-color:\s*var\(--wac-progress-fg\)/);
    expect(css).toMatch(/\.active \.progress-fill\s*{[^}]*background-color:\s*var\(--wac-progress-fg\)/);
    // The one carve-out: striped-on-preparation reverts to the empty track.
    expect(css).toMatch(/\.preparation\.deco-striped \.progress-fill\s*{[^}]*background-color:\s*transparent/);
    expect(css).toContain('.compact .preparation.deco-striped.alert-card::before');
  });

  it('paints active/ongoing stripes in a contrasting highlight, not the fill color', () => {
    // Regression: striped-on-active drew progress-color stripes over a
    // progress-color fill (invisible). The active phase overrides the stripe
    // paint to a translucent highlight so stripes read against the fill.
    expect(css).toMatch(/\.active \.progress-fill\s*{[^}]*--wac-stripe-paint:/);
    expect(css).toMatch(/\.compact \.active\.alert-card::before\s*{[^}]*--wac-stripe-paint:/);
    // Preparation leaves the paint at its progress-color default (solid stripes
    // on the empty track) — it must NOT set a highlight override.
    expect(css).not.toMatch(/\.preparation \.progress-fill\s*{[^}]*--wac-stripe-paint:/);
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
