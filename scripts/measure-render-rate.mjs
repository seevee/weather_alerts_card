#!/usr/bin/env node
// Render rate of every weather-alerts-card on one dashboard page, against a
// live Home Assistant (#393). Counts the card's own update() calls, which a
// push the render gate drops never reaches, and the page's main-thread time
// from CDP. Read-only: it opens the page and watches.
//
// Usage:
//   HA_URL=http://localhost:8123 HA_PATH=/dashboard-testing/0 HA_TOKEN=... \
//     MINUTES=5 node scripts/measure-render-rate.mjs
//
// Env:  HA_URL     base URL (default http://localhost:8123)
//       HA_PATH    dashboard path to open (default /lovelace/0)
//       HA_TOKEN   required, a long-lived access token
//       MINUTES    measuring window (default 5)
//       THROTTLE   CPU throttle factor (default 6, the review's baseline)
//       BUNDLE     optional path to a built weather-alerts-card.js, served in
//                  place of the one the instance loads, so two builds can be
//                  compared on the same live page without installing either
//
// Run one page at a time. A dashboard with many cards saturates a throttled
// headless main thread and pushes coalesce, which understates the per-card
// rate; measure a single-card page for a per-card number.

import { readFileSync } from 'fs';
import { chromium } from 'playwright';

const HA_URL = (process.env.HA_URL || 'http://localhost:8123').replace(/\/$/, '');
const HA_PATH = process.env.HA_PATH || '/lovelace/0';
const TOKEN = process.env.HA_TOKEN;
const MINUTES = Number(process.env.MINUTES || 5);
const THROTTLE = Number(process.env.THROTTLE || 6);

if (!TOKEN) {
  console.error('HA_TOKEN is required');
  process.exit(2);
}

const browser = await chromium.launch();
const context = await browser.newContext({ userAgent: 'weather-alerts-card measure-render-rate' });
const page = await context.newPage();

let served = 0;
if (process.env.BUNDLE) {
  const body = readFileSync(process.env.BUNDLE);
  await page.route(/\/weather-alerts-card\.js(\?|$)/, (route) => {
    served++;
    return route.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  process.on('exit', () => { if (!served) console.error('BUNDLE was never requested: is the card a resource on this instance?'); });
}

// Log the frontend in with the token, before the first navigation: a goto
// without it redirects to /auth/authorize and loses the page context.
await page.addInitScript(([hassUrl, token]) => {
  localStorage.hassTokens = JSON.stringify({
    access_token: token, token_type: 'Bearer', expires_in: 1e9, expires: Date.now() + 1e12,
    hassUrl, clientId: `${hassUrl}/`, refresh_token: '',
  });
}, [HA_URL, TOKEN]);

// Count update() per card and state_changed events on the page's socket.
await page.addInitScript(() => {
  const w = window;
  w.__wac = { updates: 0, fromHass: 0, events: 0 };
  customElements.whenDefined('weather-alerts-card').then(() => {
    const proto = customElements.get('weather-alerts-card').prototype;
    const update = proto.update;
    proto.update = function (changed) {
      w.__wac.updates++;
      if (changed && changed.has && changed.has('hass')) w.__wac.fromHass++;
      return update.call(this, changed);
    };
  });
  const Native = w.WebSocket;
  w.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      this.addEventListener('message', (e) => {
        if (typeof e.data === 'string' && e.data.includes('"state_changed"')) w.__wac.events++;
        // subscribe_entities pushes compressed diffs instead of state_changed.
        else if (typeof e.data === 'string' && e.data.includes('"c":{')) w.__wac.events++;
      });
    }
  };
});

await page.goto(`${HA_URL}${HA_PATH}`, { waitUntil: 'load' });
// Let the dashboard settle before counting: first render, registry, geometry.
await page.waitForTimeout(15_000);

const cards = await page.evaluate(() => {
  const found = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.tagName === 'WEATHER-ALERTS-CARD') found.push(el);
      if (el.shadowRoot) walk(el.shadowRoot);
    }
  };
  walk(document);
  return found.length;
});

const cdp = await context.newCDPSession(page);
await cdp.send('Performance.enable');
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
const taskSeconds = async () => {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find(m => m.name === 'TaskDuration')?.value ?? 0;
};

const start = await page.evaluate(() => ({ ...window.__wac }));
const startTask = await taskSeconds();
await page.waitForTimeout(MINUTES * 60_000);
const end = await page.evaluate(() => ({ ...window.__wac }));
const endTask = await taskSeconds();
await browser.close();

const per = (n) => (n / MINUTES).toFixed(1);
console.log(JSON.stringify({
  page: HA_PATH,
  bundle: process.env.BUNDLE ? `${process.env.BUNDLE} (served ${served}x)` : 'as installed',
  cards,
  minutes: MINUTES,
  throttle: THROTTLE,
  updates: end.updates - start.updates,
  updatesPerMin: per(end.updates - start.updates),
  fromHassPerMin: per(end.fromHass - start.fromHass),
  pushesPerMin: per(end.events - start.events),
  // Whole page, not the card alone: HA's own work is in here too, so compare
  // runs of the same page only.
  taskMsPerMin: (((endTask - startTask) * 1000) / MINUTES).toFixed(0),
}, null, 2));
