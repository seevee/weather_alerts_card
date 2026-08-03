#!/usr/bin/env node
// PROTOTYPE — records the tap_action → Bubble pop-up interaction as a video
// using Playwright's recordVideo (WebM out). Reuses the tap-action screenshot
// harness (scripts/screenshot-tap-action.html) but, instead of freezing the
// scene like screenshot.js does, drives the pop-up entrance as real CSS
// animations and captures them over ~3s.
//
// Deliberately self-contained (dups the small server / MDI / clock bits from
// screenshot.js) so the release-critical still pipeline stays untouched. If this
// graduates, factor the shared pieces out of screenshot.js.
//
// Run:  node scripts/capture-tap-action.js        (requires dist/ to be current)
// Out:  img/tap-action-<theme>.webm   (+ verification PNGs if ffmpeg is present)
//
// Env:  PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH  override managed Chromium
//       CAPTURE_THEMES=light,dark            subset of themes (default: both)

'use strict';

const { chromium } = require('playwright');
const { createServer } = require('http');
const { readFileSync, mkdirSync, rmSync, renameSync, statSync } = require('fs');
const { execFileSync } = require('child_process');
const { extname, resolve, join } = require('path');

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'img');
const PORT = 3743; // distinct from screenshot.js (3742) so both can run

// ---- MDI icon map (same set the harness needs; injected before load) ----
const {
  mdiWeatherTornado, mdiMapMarker, mdiOpenInNew, mdiEyeCheck,
  mdiAlertOutline, mdiCheckDecagram,
} = require('@mdi/js');
const MDI_ICONS = {
  'mdi:weather-tornado': mdiWeatherTornado,
  'mdi:map-marker': mdiMapMarker,
  'mdi:open-in-new': mdiOpenInNew,
  'mdi:eye-check': mdiEyeCheck,
  'mdi:alert-outline': mdiAlertOutline,
  'mdi:check-decagram': mdiCheckDecagram,
};

// Must match SCREENSHOT_NOW in screenshot-fixtures.js so timestamps are stable.
const SCREENSHOT_NOW = Date.UTC(2025, 5, 15, 20, 0, 0);

// Canvas size of the tap-action harness (.tap-canvas is 1200 × 1010).
const SIZE = { width: 1200, height: 1010 };

// ---- Capture-only animation CSS ----
// Added via addStyleTag AFTER the harness is ready (never in the still pipeline).
// `.capture-armed` composes the closed state; `.capture-play` runs the staggered
// entrance (fill-forwards holds the open state past the end). The messy startup
// (blank load + a beat of open/unthemed render before we arm) is not hidden here
// — it's trimmed off in post, anchored to the fixed play→close interval.
const CAPTURE_CSS = `
  @keyframes wac-cap-rise {
    from { transform: translateX(-50%) translateY(116%); }
    to   { transform: translateX(-50%) translateY(0); }
  }
  @keyframes wac-cap-fade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes wac-cap-tap {
    0%   { transform: scale(0.5); opacity: 0; }
    30%  { opacity: 0.9; }
    100% { transform: scale(1.55); opacity: 0; }
  }

  /* ARMED — composed closed state */
  .capture-armed .popup-wrap  { transform: translateX(-50%) translateY(116%); }
  .capture-armed .scrim       { opacity: 0; }
  .capture-armed .popup-pill  { opacity: 0; }
  .capture-armed .scene-title { opacity: 0; }
  .capture-armed .tap-ripple  { opacity: 0; }

  /* PLAY — staggered entrance:
       tap pulse → scrim dims dashboard → sheet rises → ② pill + title fade in */
  .capture-play .tap-ripple {
    transform-origin: center;
    animation: wac-cap-tap 520ms ease-out 150ms 1 both;
  }
  .capture-play .scrim {
    animation: wac-cap-fade 450ms ease 560ms both;
  }
  .capture-play .scene-title {
    animation: wac-cap-fade 420ms ease 640ms both;
  }
  .capture-play .popup-wrap {
    animation: wac-cap-rise 720ms cubic-bezier(.2,.8,.25,1) 640ms both;
  }
  .capture-play .popup-pill {
    animation: wac-cap-fade 400ms ease 1150ms both;
  }
`;

// Seconds of finished clip to keep, measured back from the end of the recording.
// play→close is a fixed CLOSED_HOLD_TAIL + PLAY_TAIL, so (duration − KEEP) always
// lands inside the closed hold no matter how slow startup was.
const PLAY_TAIL_MS = 2600;   // sleep after adding .capture-play
const KEEP_LEAD_MS = 420;    // closed dashboard shown before the tap
const KEEP_SECONDS = (PLAY_TAIL_MS + KEEP_LEAD_MS) / 1000;

// ---- Static file server (serves project root) ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
};
function startServer(port) {
  return new Promise((res, rej) => {
    const server = createServer((req, resp) => {
      const urlPath = req.url.split('?')[0];
      const filePath = join(ROOT, urlPath);
      try {
        const data = readFileSync(filePath);
        resp.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
        resp.end(data);
      } catch {
        resp.writeHead(404);
        resp.end('Not found: ' + urlPath);
      }
    });
    server.listen(port, '127.0.0.1', () => res(server));
    server.on('error', rej);
  });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function hasFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; }
  catch { return false; }
}

const kb = (p) => `${Math.round(statSync(p).size / 1024)} KB`;

// WebM → animated WebP for README embedding. Note: WebP's animation coding is
// far weaker than VP9's, so a full-res clip balloons to several MB on the static
// holds. Downsampling to 15fps / 1000px (q75, still text-crisp) brings it to
// ~0.9 MB — a good README weight. The WebM stays the master (and the better
// choice for Discourse, which plays video natively). Returns the output path, or
// null if this ffmpeg lacks libwebp.
function encodeWebp(srcWebm, outWebp) {
  try {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', srcWebm,
      '-vf', 'fps=15,scale=1000:-1',
      '-c:v', 'libwebp', '-loop', '0', '-q:v', '75', '-compression_level', '6',
      '-preset', 'picture', outWebp]);
    return outWebp;
  } catch {
    return null;
  }
}

(async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer(PORT);
  console.log(`Serving project root on http://127.0.0.1:${PORT}`);

  const launchOptions = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const browser = await chromium.launch(launchOptions);
  const url = `http://127.0.0.1:${PORT}/scripts/screenshot-tap-action.html`;

  const themes = (process.env.CAPTURE_THEMES || 'light,dark')
    .split(',').map(s => s.trim()).filter(Boolean);
  const ffmpeg = hasFfmpeg();

  for (const theme of themes) {
    const themeClass = theme === 'dark' ? 'theme-dark' : 'theme-light';
    console.log(`\n[${theme}] recording…`);

    // A fresh context per theme; recordVideo saves one WebM per context on close.
    const context = await browser.newContext({
      viewport: SIZE,
      deviceScaleFactor: 1,
      colorScheme: theme === 'dark' ? 'dark' : 'light',
      recordVideo: { dir: OUT_DIR, size: SIZE },
    });
    const page = await context.newPage();
    await page.addInitScript(icons => { window.__MDI_ICONS__ = icons; }, MDI_ICONS);
    await page.addInitScript(now => { Date.now = () => now; }, SCREENSHOT_NOW);

    await page.goto(url);

    // Wait for both card instances to finish their initial Lit render
    await page.waitForFunction(() => {
      return ['card-tap-chip', 'card-tap-popup']
        .every(id => document.getElementById(id)?.shadowRoot?.querySelector('.alert-card') !== null);
    }, { timeout: 10000 });

    // Compose the closed state: theme + capture CSS + .capture-armed. Anything
    // recorded before this point (blank load, a beat of open/unthemed render) is
    // trimmed off below.
    await page.addStyleTag({ content: CAPTURE_CSS });
    await page.evaluate(cls => {
      document.getElementById('tap-action-canvas').classList.add(cls, 'capture-armed');
    }, themeClass);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));

    // Generous closed hold so the end-anchored trim reliably lands here
    await sleep(1400);

    // Play the entrance, then hold on the open state
    await page.evaluate(() => document.getElementById('tap-action-canvas').classList.add('capture-play'));
    await sleep(PLAY_TAIL_MS);

    await context.close(); // finalises the video
    const raw = resolve(OUT_DIR, `tap-action-${theme}.raw.webm`);
    await page.video().saveAs(raw);
    await page.video().delete();

    const dest = resolve(OUT_DIR, `tap-action-${theme}.webm`);
    if (ffmpeg) {
      // Trim the uncontrolled lead-in: keep only the last KEEP_SECONDS, which —
      // because play→close is a fixed interval — always begins in the closed hold.
      const durOut = execFileSync('ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', raw]).toString().trim();
      const start = Math.max(0, parseFloat(durOut) - KEEP_SECONDS);
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw,
        '-ss', start.toFixed(3), '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', dest]);
      rmSync(raw);
      // Verification frames from the trimmed clip: opening (closed) and end (open)
      for (const [t, tag] of [['0.05', 'closed'], [(KEEP_SECONDS - 0.35).toFixed(2), 'open']]) {
        const png = resolve(OUT_DIR, `tap-action-${theme}-frame-${tag}.png`);
        execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t, '-i', dest, '-frames:v', '1', png]);
      }
      console.log(`  → ${dest.replace(ROOT + '/', '')}  (${kb(dest)}, + verification frames)`);

      // README-embeddable animated WebP
      const webp = encodeWebp(dest, resolve(OUT_DIR, `tap-action-${theme}.webp`));
      if (webp) console.log(`  → ${webp.replace(ROOT + '/', '')}  (${kb(webp)})`);
      else console.log('  ! WebP skipped — this ffmpeg build lacks libwebp');
    } else {
      renameSync(raw, dest);
      console.log(`  → ${dest.replace(ROOT + '/', '')}  (untrimmed — ffmpeg not found)`);
    }
  }

  await browser.close();
  server.close();
  console.log(`\nDone.${ffmpeg ? '' : '  (ffmpeg not found — skipped verification frames)'}`);
})().catch(err => { console.error(err); process.exit(1); });
