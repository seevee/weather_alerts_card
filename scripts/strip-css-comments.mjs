// Build-time removal of comments inside Lit `css` tagged templates (#394).
//
// The minifier treats template contents as opaque strings, so the design notes
// in styles.ts and the editor's styles shipped verbatim, ~26 KB of the bundle.
// Source keeps them; only the bundle loses them. Static template text is
// rewritten, `${...}` expressions pass through untouched, and CSS strings are
// copied as-is so a `/*` inside quotes survives.

/**
 * Strip CSS comments from every css`...` template in a module's source.
 * @param {string} code
 * @returns {string}
 */
export function stripCssComments(code) {
  const tag = /\bcss`/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = tag.exec(code)) !== null) {
    const start = m.index + m[0].length;
    const { text, end } = stripTemplate(code, start);
    out += code.slice(last, start) + text;
    last = end;
    tag.lastIndex = end;
  }
  return out + code.slice(last);
}

// Walk one template body from `i` (just past the opening backtick) to its
// closing backtick. Returns the rewritten body and the index of that backtick.
function stripTemplate(code, i) {
  let text = '';
  let chunk = '';
  const flush = () => {
    // A removed comment leaves trailing space or a blank line; drop both.
    // CSS strings cannot hold a raw newline, so neither pattern reaches one.
    text += chunk.replace(/[ \t]+(?=\n)/g, '').replace(/\n(?=\n)/g, '');
    chunk = '';
  };
  while (i < code.length) {
    const c = code[i];
    if (c === '`') break;
    if (c === '\\') {
      chunk += code.slice(i, i + 2);
      i += 2;
    } else if (c === '$' && code[i + 1] === '{') {
      flush();
      let depth = 0;
      const from = i;
      for (i += 1; i < code.length; i++) {
        if (code[i] === '{') depth++;
        else if (code[i] === '}' && --depth === 0) break;
      }
      i += 1;
      text += code.slice(from, i);
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < code.length && code[j] !== c && code[j] !== '`') j += code[j] === '\\' ? 2 : 1;
      chunk += code.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && code[i + 1] === '*') {
      const close = code.indexOf('*/', i + 2);
      if (close === -1) throw new Error('strip-css-comments: unterminated comment in css template');
      i = close + 2;
      // `a/**/b` must not fuse into `ab`.
      if (/\S$/.test(chunk) && /^\S/.test(code.charAt(i))) chunk += ' ';
    } else {
      chunk += c;
      i += 1;
    }
  }
  flush();
  return { text, end: i };
}

/** Rolldown plugin: apply stripCssComments to project sources. */
export function stripCssCommentsPlugin() {
  return {
    name: 'strip-css-comments',
    transform: {
      filter: { id: /[\\/]src[\\/].*\.ts$/, code: 'css`' },
      handler(code) {
        const next = stripCssComments(code);
        return next === code ? null : { code: next };
      },
    },
  };
}
