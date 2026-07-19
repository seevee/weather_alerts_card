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
});
