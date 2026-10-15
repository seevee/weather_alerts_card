// Probe for #348: does the card's pure-SVG merged outline (one nonzero-fill
// path plus a stroke masked to the outside of that same path) render inside
// a shadow root, and how does it degrade when the mask reference is invalid?
// Standalone, no card code: it re-creates the technique on two overlapping
// squares and on the 112-polygon ECCC watch fixture, screenshots them in
// headless Chromium, and samples pixels either side of each edge. Run it
// against another engine by swapping `chromium` for `firefox` / `webkit`
// once that browser is installed (`npx playwright install firefox`).
//
//   node scripts/probe-geometry-union.mjs
//
// Writes probe.html and the PNGs to the current directory. Findings on
// Chromium 153 (2026-10-15): attribute and CSS mask both resolve in the
// shadow root; an invalid reference renders the stroke unmasked (the old
// per-region look) rather than dropping the shape; opposite ring windings
// punch the overlap out, which is why the builder normalises winding.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, 'screenshot-eccc-watch.json'), 'utf8'));
const geom = fixture.features[0].geometry;
const rings = geom.coordinates.map(p => p[0]);
let minlon = Infinity, minlat = Infinity, maxlon = -Infinity, maxlat = -Infinity;
for (const r of rings) for (const [lon, lat] of r) { minlon = Math.min(minlon, lon); maxlon = Math.max(maxlon, lon); minlat = Math.min(minlat, lat); maxlat = Math.max(maxlat, lat); }
const kx = Math.cos(((minlat + maxlat) / 2) * Math.PI / 180);
const W = (maxlon - minlon) * kx, H = maxlat - minlat;
const fmt = n => Number(n.toFixed(5)).toString();
const d = rings.map(r => r.map(([lon, lat], i) => `${i ? 'L' : 'M'}${fmt((lon - minlon) * kx)},${fmt(maxlat - lat)}`).join('') + 'Z').join('');
const viewBox = `0 0 ${fmt(W)} ${fmt(H)}`;

// Two overlapping squares, same winding (CW in screen space): shared edge at x=60.
const sq = 'M20,20L60,20L60,80L20,80ZM40,30L90,30L90,90L40,90Z';
// Same squares, opposite winding on the second: nonzero would punch the overlap out.
const sqMixed = 'M20,20L60,20L60,80L20,80ZM40,30L40,90L90,90L90,30Z';

const svgFor = (id, path, vb, { maskRef = `url(#m-${id})`, viaCss = false } = {}) => `
<svg viewBox="${vb}" width="${vb === '0 0 100 100' ? 200 : 520}" height="${vb === '0 0 100 100' ? 200 : 260}" preserveAspectRatio="xMidYMid meet" style="display:block;background:#fff">
  <defs>
    <mask id="m-${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
      <rect x="0" y="0" width="100%" height="100%" fill="#fff"/>
      <path d="${path}" fill="#000" fill-rule="nonzero"/>
    </mask>
  </defs>
  <path d="${path}" fill="rgba(249,102,2,0.18)" fill-rule="nonzero" stroke="none"/>
  <path d="${path}" fill="none" stroke="#f96602" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"
        ${viaCss ? `style="mask:${maskRef}"` : `mask="${maskRef}"`}/>
</svg>`;

const html = `<!doctype html><meta charset="utf-8">
<style>body{margin:0;background:#fff;font:12px sans-serif} .row{display:flex;gap:12px;padding:8px} .cell{border:1px solid #ccc} h4{margin:2px 0 4px}</style>
<div class="row" id="light">
  <div class="cell"><h4>A light DOM, attr mask</h4>${svgFor('a', sq, '0 0 100 100')}</div>
  <div class="cell"><h4>B light DOM, NO mask (current look)</h4>${svgFor('b', sq, '0 0 100 100', { maskRef: 'none' })}</div>
</div>
<div class="row" id="shadow"></div>
<div class="row" id="fixture"></div>
<script>
  class P extends HTMLElement { constructor(){ super(); this.attachShadow({mode:'open'}); } }
  customElements.define('probe-el', P);
  const put = (rowId, title, svg) => {
    const el = document.createElement('probe-el');
    el.shadowRoot.innerHTML = '<style>:host{display:block;border:1px solid #ccc}h4{margin:2px 0 4px;font:12px sans-serif}</style><h4>'+title+'</h4>'+svg;
    document.getElementById(rowId).appendChild(el);
    return el;
  };
  put('shadow', 'C shadow DOM, attr mask', ${JSON.stringify(svgFor('c', sq, '0 0 100 100'))});
  put('shadow', 'D shadow DOM, CSS mask', ${JSON.stringify(svgFor('d', sq, '0 0 100 100', { viaCss: true }))});
  put('shadow', 'E shadow DOM, INVALID ref', ${JSON.stringify(svgFor('e', sq, '0 0 100 100', { maskRef: 'url(#does-not-exist)' }))});
  put('shadow', 'F shadow DOM, mixed winding', ${JSON.stringify(svgFor('f', sqMixed, '0 0 100 100'))});
  put('fixture', 'G 112-polygon ECCC watch, shadow DOM, attr mask', ${JSON.stringify(svgFor('g', d, viewBox))});
  put('fixture', 'H same, no mask (current per-ring look)', ${JSON.stringify(svgFor('h', d, viewBox, { maskRef: 'none' }))});
</script>`;
writeFileSync('probe.html', html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 700 }, deviceScaleFactor: 1 });
await page.goto('file://' + process.cwd() + '/probe.html');
await page.waitForTimeout(300);
await page.screenshot({ path: 'probe-all.png', fullPage: true });

// Pixel sampling: for each 100x100 square case, sample the interior shared
// edge (x=60 in viewBox, y=55 -> inside both squares' overlap boundary) and
// the outer edge (x=20, y=50), and the overlap interior (x=50,y=55).
const sample = async (locator) => {
  const box = await locator.boundingBox();
  const shot = await page.screenshot({ clip: box });
  return await page.evaluate(async ([b64, w, h]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const px = (vx, vy) => { const [r,g,b] = ctx.getImageData(Math.round(vx*2), Math.round(vy*2), 1, 1).data; return [r,g,b]; };
    return { sharedEdge: px(60, 55), sharedEdgeOut: px(59.3, 55), outerEdgeOutside: px(19.3, 50), outerEdgeInside: px(20.7, 50), overlapInterior: px(50, 55), singleInterior: px(30, 50) };
  }, [shot.toString('base64'), Math.round(box.width), Math.round(box.height)]);
};
const out = {};
out.A_light_attr = await sample(page.locator('#light .cell:nth-child(1) svg'));
out.B_light_nomask = await sample(page.locator('#light .cell:nth-child(2) svg'));
for (const [i, name] of ['C_shadow_attr', 'D_shadow_css', 'E_shadow_invalid', 'F_shadow_mixed'].entries()) {
  out[name] = await sample(page.locator('probe-el').nth(i).locator('svg'));
}
console.log(JSON.stringify(out, null, 1));
await page.locator('probe-el').nth(4).screenshot({ path: 'probe-fixture-masked.png' });
await page.locator('probe-el').nth(5).screenshot({ path: 'probe-fixture-unmasked.png' });
console.log('chromium', browser.version());
await browser.close();
