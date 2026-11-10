/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import stylesSource from '../src/styles.ts?raw';
import editorSource from '../src/weather-alerts-card-editor.ts?raw';
import { stripCssComments } from '../scripts/strip-css-comments.mjs';

// The build strips comments from css`` templates (#394). These pin what it may
// and may not touch, since a wrong cut breaks every card's styles silently.
describe('stripCssComments', () => {
  it('removes block and multi-line comments and the lines they leave empty', () => {
    const src = 'const s = css`\n  /* note\n     more */\n  .a { color: red; }\n\n  /* x */\n  .b { top: 0; }\n`;';
    expect(stripCssComments(src)).toBe('const s = css`\n  .a { color: red; }\n  .b { top: 0; }\n`;');
  });

  it('drops the space a trailing comment leaves behind', () => {
    expect(stripCssComments('css`\n  .a { top: 0; } /* why */\n`')).toBe('css`\n  .a { top: 0; }\n`');
  });

  it('keeps tokens apart when a comment separated them', () => {
    expect(stripCssComments('css`a/**/b`')).toBe('css`a b`');
  });

  it('leaves comment-like text in CSS strings alone', () => {
    const src = 'css`.a::before { content: "/* not a comment */"; } .b { content: \'/*\'; }`';
    expect(stripCssComments(src)).toBe(src);
  });

  it('passes interpolations through untouched', () => {
    const src = 'css`/* c */.a { width: ${unsafeCSS(`/* keep */ ${w}`)}px; }`';
    expect(stripCssComments(src)).toBe('css`.a { width: ${unsafeCSS(`/* keep */ ${w}`)}px; }`');
  });

  it('touches nothing outside css templates', () => {
    const src = '/* file */ const h = html`<!-- x -->/* y */`; const s = css`/* z */.a{}`; /* tail */';
    expect(stripCssComments(src)).toBe('/* file */ const h = html`<!-- x -->/* y */`; const s = css`.a{}`; /* tail */');
  });

  it('strips every comment from the real styles', () => {
    for (const [f, source] of [['styles.ts', stylesSource], ['editor', editorSource]] as const) {
      const out = stripCssComments(source);
      const bodies = [...out.matchAll(/\bcss`([^`]*)`/g)].map(m => m[1] ?? '');
      expect(bodies.length, f).toBeGreaterThan(0);
      for (const b of bodies) expect(b, f).not.toContain('/*');
    }
  });
});
