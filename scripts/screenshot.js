#!/usr/bin/env node
// Captures README screenshots using a standalone HTML harness + headless Chromium.
// Run via: npm run screenshot  (requires dist/ to be current)
//          npm run screenshot:update  (rebuilds first)
//
// Env: PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH  override Playwright's managed Chromium with a system binary
//      SCREENSHOT_THEMES  comma-separated subset: severity,nws,hero,themes  (default: all)

'use strict';

const { chromium } = require('playwright');
const { createServer } = require('http');
const { readFileSync } = require('fs');
const { extname, resolve, join } = require('path');

const ROOT = resolve(__dirname, '..');

// ---- MDI icon map (paths injected into the page before load) ----
const {
  mdiWeatherTornado, mdiWeatherLightning, mdiHomeFlood, mdiWeatherSnowyHeavy,
  mdiSnowflake, mdiLandslide, mdiWeatherWindy, mdiFire, mdiWeatherSunnyAlert,
  mdiWeatherFog, mdiWeatherHurricane, mdiAlertCircleOutline, mdiWeatherSunny,
  mdiChevronDown, mdiOpenInNew, mdiCheckDecagram, mdiEyeCheck,
  mdiHelpCircleOutline, mdiBullseyeArrow, mdiMapMarker,
} = require('@mdi/js');

const MDI_ICONS = {
  'mdi:weather-tornado': mdiWeatherTornado,
  'mdi:weather-lightning': mdiWeatherLightning,
  'mdi:home-flood': mdiHomeFlood,
  'mdi:weather-snowy-heavy': mdiWeatherSnowyHeavy,
  'mdi:snowflake': mdiSnowflake,
  'mdi:landslide': mdiLandslide,
  'mdi:weather-windy': mdiWeatherWindy,
  'mdi:fire': mdiFire,
  'mdi:weather-sunny-alert': mdiWeatherSunnyAlert,
  'mdi:weather-fog': mdiWeatherFog,
  'mdi:weather-hurricane': mdiWeatherHurricane,
  'mdi:alert-circle-outline': mdiAlertCircleOutline,
  'mdi:weather-sunny': mdiWeatherSunny,
  'mdi:chevron-down': mdiChevronDown,
  'mdi:open-in-new': mdiOpenInNew,
  'mdi:check-decagram': mdiCheckDecagram,
  'mdi:eye-check': mdiEyeCheck,
  'mdi:help-circle-outline': mdiHelpCircleOutline,
  'mdi:bullseye-arrow': mdiBullseyeArrow,
  'mdi:map-marker': mdiMapMarker,
};

// ---- Static file server ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css',
  '.png': 'image/png',
  '.json': 'application/json',
};

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const urlPath = req.url.split('?')[0];
      const filePath = join(ROOT, urlPath === '/' ? '/scripts/screenshot-harness.html' : urlPath);
      try {
        const data = readFileSync(filePath);
        const mime = MIME[extname(filePath)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found: ' + urlPath);
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

// ---- Screenshot scenarios ----
// Two card instances in the harness; each is shot in light and dark.
//   card-severity-open: default layout, severity colors.  Shot collapsed and
//                       with "Read Details" expanded (via Playwright click).
//   card-nws-compact:   compact layout, NWS event colors, all alerts collapsed.
const ALL_SCENARIOS = [
  //{ cardId: 'card-severity-open', colorScheme: 'light', label: 'severity light open   ', out: 'img/severity-light-open.png' },
  //{ cardId: 'card-severity-open', colorScheme: 'dark', label: 'severity dark  open   ', out: 'img/severity-dark-open.png' },
  { cardId: 'card-severity-open', colorScheme: 'light', label: 'severity light details', out: 'img/severity-light-details.png', expand: true },
  { cardId: 'card-severity-open', colorScheme: 'dark', label: 'severity dark  details', out: 'img/severity-dark-details.png', expand: true },
  { cardId: 'card-nws-compact', colorScheme: 'light', label: 'nws     light compact ', out: 'img/nws-light-compact.png' },
  { cardId: 'card-nws-compact', colorScheme: 'dark', label: 'nws     dark  compact ', out: 'img/nws-dark-compact.png' },
];

// Filter by SCREENSHOT_THEMES env var if set (e.g. "nws" or "severity,nws")
const themeFilter = (process.env.SCREENSHOT_THEMES || '').split(',').map(s => s.trim()).filter(Boolean);
const SCENARIOS = themeFilter.length
  ? ALL_SCENARIOS.filter(s => themeFilter.some(t => s.cardId.startsWith(`card-${t}`)))
  : ALL_SCENARIOS;

// Fixed timestamp anchor — must match SCREENSHOT_NOW in screenshot-fixtures.js.
// Injected into the browser so Date.now() returns a stable value and all
// rendered timestamps / progress bars are deterministic across runs.
const SCREENSHOT_NOW = Date.UTC(2025, 5, 15, 20, 0, 0);

const PORT = 3742;

(async () => {
  const server = await startServer(PORT);
  console.log(`Serving project root on http://127.0.0.1:${PORT}`);

  const launchOptions = { args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  }
  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // Inject MDI icon map before any page script runs (persists across navigations)
  await page.addInitScript(icons => { window.__MDI_ICONS__ = icons; }, MDI_ICONS);

  // Freeze Date.now() so rendered timestamps and progress bars are deterministic
  await page.addInitScript(now => { Date.now = () => now; }, SCREENSHOT_NOW);

  const URL = `http://127.0.0.1:${PORT}/scripts/screenshot-harness.html`;

  for (const scenario of SCENARIOS) {
    const { cardId, colorScheme, label, out } = scenario;
    console.log(`  ${label} → ${out}`);

    // Set color scheme BEFORE navigation so the page's @media rules resolve
    // correctly from the first paint — avoids stale CSS custom properties in
    // shadow DOM that can linger when toggling emulateMedia mid-session.
    await page.emulateMedia({ colorScheme });
    await page.goto(URL);

    // Wait for both card instances to finish their initial Lit render
    await page.waitForFunction(() => {
      const ids = ['card-severity-open', 'card-nws-compact'];
      return ids.every(id => document.getElementById(id)?.shadowRoot?.querySelector('.alert-card') !== null);
    }, { timeout: 10000 });

    // Disable animations for deterministic screenshots
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });

    // One rAF to let layout settle after style injection
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));

    // Click "Read Details" on the first alert to expand its details content
    if (scenario.expand) {
      await page.locator(`#${cardId} .details-summary`).first().click();
      // Wait for Lit to finish its async re-render after the state change
      await page.evaluate(id => document.getElementById(id).updateComplete, cardId);
      await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
    }

    // Screenshot the wrapper (parent) so the ha-card shadow and page bg are visible
    await page.locator(`#${cardId}`).locator('xpath=..').screenshot({ path: resolve(ROOT, out), type: 'png' });
  }

  // ---- Composite images (hero + themes) at 2x DPR for retina sharpness ----
  // Each composite is captured in light and dark variants. The adaptive SVG
  // encoder combines each pair into a single theme-switching SVG for the README.

  const COMPOSITE_SETS = [
    {
      name: 'hero',
      url: `http://127.0.0.1:${PORT}/scripts/screenshot-hero.html`,
      canvasId: 'hero-canvas',
      cardIds: ['card-severity', 'card-nws'],
      variants: [
        { theme: 'theme-light', label: 'hero light  ', out: 'img/hero-light.png' },
        { theme: 'theme-dark',  label: 'hero dark   ', out: 'img/hero-dark.png' },
      ],
      afterRender: async (page) => {
        // Expand the last compact alert (Snowflake Watch) so the hero image
        // showcases the expanded details view and balances the vertical height.
        await page.locator('#card-nws .compact-row').last().click();
        await page.evaluate(id => document.getElementById(id).updateComplete, 'card-nws');
        await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));

        // Also expand its "Read Details" section to show the full description
        await page.locator('#card-nws .details-summary').last().click();
        await page.evaluate(id => document.getElementById(id).updateComplete, 'card-nws');
        await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
      },
    },
    {
      name: 'themes',
      url: `http://127.0.0.1:${PORT}/scripts/screenshot-themes.html`,
      canvasId: 'themes-canvas',
      cardIds: ['card-severity', 'card-nws', 'card-meteoalarm'],
      variants: [
        { theme: 'theme-light', label: 'themes light', out: 'img/themes-light.png' },
        { theme: 'theme-dark',  label: 'themes dark ', out: 'img/themes-dark.png' },
      ],
    },
  ];

  // Close the 1x context and create a 2x one for composite captures
  await context.close();
  const compositeContext = await browser.newContext({
    viewport: { width: 1100, height: 900 },
    deviceScaleFactor: 2,
  });
  const compositePage = await compositeContext.newPage();
  await compositePage.addInitScript(icons => { window.__MDI_ICONS__ = icons; }, MDI_ICONS);
  await compositePage.addInitScript(now => { Date.now = () => now; }, SCREENSHOT_NOW);

  for (const set of COMPOSITE_SETS) {
    if (themeFilter.length && !themeFilter.includes(set.name)) continue;

    for (const { theme, label, out } of set.variants) {
      console.log(`  ${label}         → ${out}`);

      await compositePage.goto(set.url);

      // Wait for all card instances to render
      await compositePage.waitForFunction(ids => {
        return ids.every(id => document.getElementById(id)?.shadowRoot?.querySelector('.alert-card') !== null);
      }, set.cardIds, { timeout: 10000 });

      // Apply theme class to the canvas
      await compositePage.evaluate(([canvasId, cls]) => document.getElementById(canvasId).classList.add(cls), [set.canvasId, theme]);

      // Disable animations
      await compositePage.addStyleTag({
        content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
      });
      await compositePage.evaluate(() => new Promise(r => requestAnimationFrame(r)));

      // Run any post-render actions (e.g. expanding alerts)
      if (set.afterRender) {
        await set.afterRender(compositePage);
      }

      await compositePage.locator(`#${set.canvasId}`).screenshot({ path: resolve(ROOT, out), type: 'png' });
    }
  }
  await compositeContext.close();

  await browser.close();
  server.close();
  console.log('\nDone. Screenshots written to img/');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
