import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import type { Connection } from 'home-assistant-js-websocket';

// jsdom lacks matchMedia; the card's _motionQuery touches it during
// construction, so the polyfill must be installed before the card module loads.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

import {
  WeatherAlertsCard,
  GEOMETRY_MISS_COOLDOWN_MS,
  GEOMETRY_MISS_MAX_ATTEMPTS,
} from '../src/weather-alerts-card';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

// The out-of-band pieces of the geometry mini-map: the polygon fetch retry
// policy (#258) and the map_tiles basemap token (#259). Both run from
// updated()/connectedCallback, never from render, so they're driven here by
// hass assignments against a scripted fake connection.

const ENTITY = 'sensor.cap_alerts_wmo_cap_alert_flood_abc123';
const REF = '01KSE9RAS1QCFZN92S750NKM43:wmo:45d3bb935518';
const BBOX = [-105.3, 39.9, -105.1, 40.1];
const POLYGON = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { ref: REF },
    geometry: {
      type: 'Polygon',
      coordinates: [[[-105.3, 39.9], [-105.1, 39.9], [-105.1, 40.1], [-105.3, 40.1], [-105.3, 39.9]]],
    },
  }],
};

function capAttrs(): Record<string, unknown> {
  const now = Date.now();
  return {
    incident_platform_version: '1.0',
    id: 'urn:oid:2.49.0.1.764.0.flood',
    event: 'Flood',
    severity: 'Severe',
    severity_normalized: 'severe',
    sent: new Date(now - 60 * 60 * 1000).toISOString(),
    expires: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
    area_desc: 'Boulder County',
    bbox: BBOX,
    geometry_ref: REF,
  };
}

type Script = (msg: { type: string }) => Promise<unknown>;

// Scripted connection: `geometry` and `token` decide each call's outcome in
// sequence; the last entry repeats. Counts every command by type, and exposes
// the `ready` listeners the card registers so a test can fire a reconnect.
function makeConn(opts: { geometry?: unknown[]; token?: unknown[] } = {}) {
  const calls: Record<string, number> = {};
  const listeners = new Map<string, Set<() => void>>();
  const next = (queue: unknown[] | undefined) => {
    if (!queue || queue.length === 0) return new Error('unknown_command');
    return queue.length > 1 ? queue.shift()! : queue[0];
  };
  const impl: Script = async (msg) => {
    calls[msg.type] = (calls[msg.type] ?? 0) + 1;
    const outcome = msg.type === 'cap_alerts/geometry'
      ? next(opts.geometry)
      : msg.type === 'map_tiles/access_token'
        ? next(opts.token)
        : new Error('unknown_command');
    if (outcome instanceof Error) throw outcome;
    return outcome;
  };
  const conn = {
    sendMessagePromise: impl,
    addEventListener: (type: string, cb: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(cb);
    },
    removeEventListener: (type: string, cb: () => void) => {
      listeners.get(type)?.delete(cb);
    },
  } as unknown as Connection;
  return {
    conn,
    calls,
    fire(type: string) { listeners.get(type)?.forEach(cb => cb()); },
    listenerCount(type: string) { return listeners.get(type)?.size ?? 0; },
  };
}

function makeHass(conn: Connection, extra: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    states: { [ENTITY]: { state: 'on', attributes: capAttrs() } },
    locale: { language: 'en' },
    connection: conn,
    ...extra,
  } as unknown as HomeAssistant;
}

async function flush(card: WeatherAlertsCard): Promise<void> {
  await card.updateComplete;
  await new Promise(r => setTimeout(r, 0));
  await new Promise(r => setTimeout(r, 0));
  await card.updateComplete;
}

async function mount(config: Partial<WeatherAlertsCardConfig>, hass: HomeAssistant): Promise<WeatherAlertsCard> {
  const card = document.createElement('weather-alerts-card');
  card.setConfig({
    type: 'custom:weather-alerts-card',
    entity: ENTITY,
    animations: false,
    showGeometry: true,
    expandDetails: true,
    ...config,
  });
  card.hass = hass;
  document.body.appendChild(card);
  await flush(card);
  return card;
}

// Re-assigning a fresh hass object is what a state update looks like to the
// card: same connection, new object identity.
async function tick(card: WeatherAlertsCard, hass: HomeAssistant): Promise<HomeAssistant> {
  const next = { ...hass };
  card.hass = next;
  await flush(card);
  return next;
}

const q = (card: WeatherAlertsCard, sel: string) => card.shadowRoot!.querySelector(sel);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('geometry miss cooldown (#258)', () => {
  it('retries a missed ref after the cooldown and renders the polygon', async () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const c = makeConn({ geometry: [new Error('not_found'), POLYGON] });
    const card = await mount({}, makeHass(c.conn));
    let hass = card.hass;
    expect(c.calls['cap_alerts/geometry']).toBe(1);
    expect(q(card, '.geometry-shape')).toBeNull();

    // Inside the cooldown: no request, however many updates arrive.
    for (let i = 0; i < 5; i++) {
      now += 5_000;
      hass = await tick(card, hass);
    }
    expect(c.calls['cap_alerts/geometry']).toBe(1);

    // Past the cooldown: exactly one retry, and it lands.
    now += GEOMETRY_MISS_COOLDOWN_MS;
    hass = await tick(card, hass);
    expect(c.calls['cap_alerts/geometry']).toBe(2);
    expect(q(card, '.geometry-shape')).not.toBeNull();

    // A hit is final: further updates and cooldowns never refetch.
    now += GEOMETRY_MISS_COOLDOWN_MS * 3;
    await tick(card, hass);
    expect(c.calls['cap_alerts/geometry']).toBe(2);
  });

  it('gives up on a ref that keeps missing after the attempt cap', async () => {
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const c = makeConn({ geometry: [new Error('not_found')] });
    const card = await mount({}, makeHass(c.conn));
    let hass = card.hass;
    for (let i = 0; i < GEOMETRY_MISS_MAX_ATTEMPTS + 3; i++) {
      now += GEOMETRY_MISS_COOLDOWN_MS + 1;
      hass = await tick(card, hass);
    }
    expect(c.calls['cap_alerts/geometry']).toBe(GEOMETRY_MISS_MAX_ATTEMPTS);
    // Still drawing the bbox frame, never an error.
    expect(q(card, '.geometry-frame')).not.toBeNull();
    expect(q(card, '.geometry-shape')).toBeNull();
  });

  it('forgets misses on a connection swap and fetches afresh', async () => {
    const now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const a = makeConn({ geometry: [new Error('not_found')] });
    const card = await mount({}, makeHass(a.conn));
    expect(a.calls['cap_alerts/geometry']).toBe(1);

    // Same instant, new socket: the miss belonged to the old store.
    const b = makeConn({ geometry: [POLYGON] });
    card.hass = makeHass(b.conn);
    await flush(card);
    expect(b.calls['cap_alerts/geometry']).toBe(1);
    expect(q(card, '.geometry-shape')).not.toBeNull();
  });
});

describe('map_tiles basemap token (#259)', () => {
  const MAP = { geometryStyle: 'map' as const };

  it('renders proxy tiles carrying the token, from hassUrl', async () => {
    const c = makeConn({ token: [{ token: 'tok1' }], geometry: [POLYGON] });
    const card = await mount(MAP, makeHass(c.conn, {
      auth: { data: { hassUrl: 'http://ha.local:8123' } },
    }));
    expect(c.calls['map_tiles/access_token']).toBe(1);
    const img = q(card, '.alert-geometry.map image');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('href')).toMatch(
      /^http:\/\/ha\.local:8123\/api\/map_tiles\/raster\/\d+\/\d+\/\d+\.png\?token=tok1$/,
    );
    expect(q(card, '.geometry-attrib')!.textContent).toBe('© OpenStreetMap contributors');
  });

  it('re-renders with the new token when the connection reports ready', async () => {
    const c = makeConn({ token: [{ token: 'tok1' }, { token: 'tok2' }], geometry: [POLYGON] });
    const card = await mount(MAP, makeHass(c.conn));
    expect(q(card, '.alert-geometry.map image')!.getAttribute('href')).toContain('token=tok1');
    expect(c.listenerCount('ready')).toBe(1);

    c.fire('ready');
    await flush(card);
    expect(c.calls['map_tiles/access_token']).toBe(2);
    expect(q(card, '.alert-geometry.map image')!.getAttribute('href')).toContain('token=tok2');
  });

  it('asks once per connection, not once per hass update', async () => {
    const c = makeConn({ token: [{ token: 'tok1' }], geometry: [POLYGON] });
    const card = await mount(MAP, makeHass(c.conn));
    let hass = card.hass;
    for (let i = 0; i < 5; i++) hass = await tick(card, hass);
    expect(c.calls['map_tiles/access_token']).toBe(1);
  });

  it('falls back to the outline on a core without map_tiles, with no retry storm', async () => {
    const c = makeConn({ geometry: [POLYGON] }); // token command unknown → rejects
    const card = await mount(MAP, makeHass(c.conn));
    let hass = card.hass;
    for (let i = 0; i < 5; i++) hass = await tick(card, hass);
    expect(c.calls['map_tiles/access_token']).toBe(1);
    expect(q(card, '.alert-geometry.map')).toBeNull();
    // The plain outline still shows the polygon.
    expect(q(card, '.alert-geometry .geometry-shape')).not.toBeNull();
  });

  it('inverts the tile layer in dark mode, never the polygon', async () => {
    const c = makeConn({ token: [{ token: 'tok1' }], geometry: [POLYGON] });
    const card = await mount(MAP, makeHass(c.conn, { themes: { darkMode: true } }));
    const svg = q(card, '.alert-geometry.map')!;
    expect(svg.classList.contains('dark')).toBe(true);
    expect(q(card, '.geometry-tiles image')).not.toBeNull();
    expect(q(card, '.geometry-tiles .geometry-shape')).toBeNull();
  });

  it('leaves a user tile override alone: no token, no inversion, generic OSM credit', async () => {
    const c = makeConn({ geometry: [POLYGON] });
    const card = await mount({
      ...MAP,
      geometryTileUrl: 'https://tiles.example.com/{z}/{x}/{y}.png',
    }, makeHass(c.conn, { themes: { darkMode: true } }));
    expect(c.calls['map_tiles/access_token']).toBeUndefined();
    expect(c.listenerCount('ready')).toBe(0);
    const svg = q(card, '.alert-geometry.map')!;
    expect(svg.classList.contains('dark')).toBe(false);
    expect(q(card, '.alert-geometry.map image')!.getAttribute('href'))
      .toMatch(/^https:\/\/tiles\.example\.com\//);
    expect(q(card, '.geometry-attrib')!.textContent).toBe('© OpenStreetMap');
  });

  it('does not touch the token command for the shape style', async () => {
    const c = makeConn({ token: [{ token: 'tok1' }], geometry: [POLYGON] });
    await mount({ geometryStyle: 'shape' }, makeHass(c.conn));
    expect(c.calls['map_tiles/access_token']).toBeUndefined();
  });

  it('drops the ready listener and timer on disconnect', async () => {
    const c = makeConn({ token: [{ token: 'tok1' }], geometry: [POLYGON] });
    const card = await mount(MAP, makeHass(c.conn));
    expect(c.listenerCount('ready')).toBe(1);
    card.remove();
    expect(c.listenerCount('ready')).toBe(0);
    // A reconnect after removal must not reach a detached card.
    c.fire('ready');
    await new Promise(r => setTimeout(r, 0));
    expect(c.calls['map_tiles/access_token']).toBe(1);
  });
});
