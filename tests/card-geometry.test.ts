import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// jsdom lacks matchMedia; the card touches it during construction, so the
// polyfill must be installed before the card module loads.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false, media: '', onchange: null,
        addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
      }),
    });
  }
});

import '../src/weather-alerts-card';
import { REFERENCE_FRAME_MAX_KM } from '../src/geometry';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

interface CardInternals {
  setConfig(config: WeatherAlertsCardConfig): void;
  hass: HomeAssistant;
  remove(): void;
  shadowRoot: ShadowRoot | null;
}

const HOUR = 3600 * 1000;
const RFS_SOURCE = 'nsw_rural_fire_service_feed';

// Home: Sydney. The incident is ~40 km west; the far reference is Melbourne
// (~713 km), well past REFERENCE_FRAME_MAX_KM.
const HOME = { latitude: -33.8688, longitude: 151.2093 };
const INCIDENT = { latitude: -33.8688, longitude: 150.7776 };
const MELBOURNE = { latitude: -37.8136, longitude: 144.9631 };

const rfsIncident = () => ({
  state: '40',
  attributes: {
    source: RFS_SOURCE,
    external_id: 'https://incidents.rfs.nsw.gov.au/api/v1/incidents/1',
    category: 'Advice',
    status: 'Being controlled',
    type: 'Bush Fire',
    location: 'Near Fire',
    council_area: 'Somewhere',
    size: '5 ha',
    fire: true,
    responsible_agency: 'Rural Fire Service',
    publication_date: new Date(Date.now() - HOUR).toISOString(),
    ...INCIDENT,
  },
});

// A cap_alerts entity with a bbox but no geometry_ref: the frame renders, and
// no out-of-band polygon fetch is attempted. Boulder-ish, far from Sydney.
const capAlert = () => ({
  state: 'on',
  attributes: {
    incident_platform_version: '1.0',
    id: 'urn:oid:2.49.0.1.840.0.abc',
    event: 'Tornado Warning',
    severity: 'Severe',
    severity_normalized: 'severe',
    certainty: 'Likely',
    urgency: 'Immediate',
    sent: new Date(Date.now() - 2 * HOUR).toISOString(),
    onset: new Date(Date.now() - HOUR).toISOString(),
    expires: new Date(Date.now() + 3 * HOUR).toISOString(),
    description: 'A confirmed tornado is on the ground.',
    instruction: 'Take shelter immediately.',
    headline: 'Tornado Warning',
    area_desc: 'Boulder; Larimer',
    provider: 'nws',
    phase: 'new',
    msg_type: 'Alert',
    bbox: [-105.3, 39.9, -105.1, 40.1],
  },
});

// A cap_alerts point-only incident (NSW RFS via the Australian provider): the
// marker is the only location, so the integration publishes a degenerate bbox
// around it. Whitton, NSW.
const capPointAlert = () => ({
  state: 'minor',
  attributes: {
    incident_platform_version: '1.0',
    id: 'd9b7ce4dc750',
    event: 'Bushfire',
    severity: 'Minor',
    severity_normalized: 'minor',
    certainty: 'Observed',
    urgency: 'Expected',
    sent: new Date(Date.now() - 2 * HOUR).toISOString(),
    effective: new Date(Date.now() - 2 * HOUR).toISOString(),
    description: 'ALERT LEVEL: Not Applicable',
    headline: 'WHITTON DARLINGTON POINT RD, WHITTON',
    area_desc: 'WHITTON DARLINGTON POINT RD, WHITTON 2705',
    provider: 'au',
    phase: 'new',
    msg_type: 'Alert',
    bbox: [146.158767701, -34.598636627, 146.158767701, -34.598636627] as [number, number, number, number],
    points: [[146.158767701, -34.598636627]],
  },
});

// Tile URL "…/{z}/{x}/{y}.png" → z.
function tileZoom(href: string): number {
  const m = href.match(/\/(\d+)\/\d+\/\d+(?:[.@][\w.]+)?$/);
  return m ? Number(m[1]) : NaN;
}

const nwsAlert = () => ({
  state: '1',
  attributes: {
    Alerts: [{
      ID: 'wind-severe',
      Event: 'High Wind Warning',
      Severity: 'Severe',
      Sent: new Date(Date.now() - 2 * HOUR).toISOString(),
      Onset: new Date(Date.now() - HOUR).toISOString(),
      Ends: new Date(Date.now() + 3 * HOUR).toISOString(),
      Expires: new Date(Date.now() + 3 * HOUR).toISOString(),
      Description: 'Damaging winds.',
      Instruction: '',
      URL: '',
      Headline: '',
    }],
  },
});

function makeHass(
  states: Record<string, { state: string; attributes: Record<string, unknown> }>,
  config: Record<string, unknown> | null = HOME,
): HomeAssistant {
  const hass: Record<string, unknown> = { states, locale: { language: 'en' }, entities: {} };
  if (config !== null) hass.config = config;
  return hass as unknown as HomeAssistant;
}

const rfsConfig = (extra: Partial<WeatherAlertsCardConfig> = {}): WeatherAlertsCardConfig => ({
  type: 'custom:weather-alerts-card',
  provider: 'nsw_rfs',
  sources: [RFS_SOURCE],
  expandDetails: true,
  showGeometry: true,
  ...extra,
} as WeatherAlertsCardConfig);

const capConfig = (extra: Partial<WeatherAlertsCardConfig> = {}): WeatherAlertsCardConfig => ({
  type: 'custom:weather-alerts-card',
  entity: 'sensor.cap_alert_abc',
  expandDetails: true,
  showGeometry: true,
  ...extra,
} as WeatherAlertsCardConfig);

// Bypass the map_tiles token fetch: a user tile override renders immediately.
const MAP = { geometryStyle: 'map' as const, geometryTileUrl: 'https://tiles.example.com/{z}/{x}/{y}.png' };

async function mountCard(config: WeatherAlertsCardConfig, hass: HomeAssistant): Promise<{ card: CardInternals; cleanup: () => void }> {
  const card = document.createElement('weather-alerts-card') as unknown as CardInternals;
  card.setConfig(config);
  card.hass = hass;
  document.body.appendChild(card);
  await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
  return { card, cleanup: () => card.remove() };
}

function root(card: CardInternals): ShadowRoot {
  if (!card.shadowRoot) throw new Error('no shadowRoot');
  return card.shadowRoot;
}

const q = (card: CardInternals, sel: string) => root(card).querySelector(sel);
const qAll = (card: CardInternals, sel: string) => root(card).querySelectorAll(sel);

// viewBox "0 0 w h" → the frame's extent; a path "Mx,y…" → its anchor.
function viewBoxOf(svg: Element): { w: number; h: number } {
  const [, , w, h] = (svg.getAttribute('viewBox') || '').split(' ').map(Number);
  return { w, h };
}
function anchorOf(path: Element): { x: number; y: number } {
  const m = (path.getAttribute('d') || '').match(/^M(-?[\d.]+),(-?[\d.]+)/);
  if (!m) throw new Error(`no anchor in ${path.getAttribute('d')}`);
  return { x: Number(m[1]), y: Number(m[2]) };
}
function inside(p: { x: number; y: number }, box: { w: number; h: number }): boolean {
  return p.x >= 0 && p.x <= box.w && p.y >= 0 && p.y <= box.h;
}

beforeEach(() => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      get length() { return store.size; },
      clear: () => store.clear(),
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      key: (i: number) => Array.from(store.keys())[i] ?? null,
    },
    configurable: true,
    writable: true,
  });
});

describe('point-incident mini-map (#206)', () => {
  it('renders an incident marker in an untinted synthesized frame (shape style)', async () => {
    const { card, cleanup } = await mountCard(rfsConfig(), makeHass({ 'geo_location.fire': rfsIncident() }));
    const svg = q(card, 'svg.alert-geometry');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('point')).toBe(true);
    expect(svg!.classList.contains('map')).toBe(false);
    const marker = q(card, '.geometry-marker');
    expect(marker).not.toBeNull();
    // Alone in its frame, the incident sits at the centre.
    const { w, h } = viewBoxOf(svg!);
    const a = anchorOf(marker!);
    expect(a.x).toBeCloseTo(w / 2, 3);
    expect(a.y).toBeCloseTo(h / 2, 3);
    expect(qAll(card, '.geometry-shape')).toHaveLength(0);
    expect(q(card, '.geometry-marker-casing')).toBeNull();
    expect(svg!.getAttribute('role')).toBe('img');
    expect(svg!.getAttribute('aria-label')).toBe('Somewhere');
    cleanup();
  });

  it('renders tiles + a cased marker in map style', async () => {
    const { card, cleanup } = await mountCard(rfsConfig(MAP), makeHass({ 'geo_location.fire': rfsIncident() }));
    const svg = q(card, 'svg.alert-geometry.map');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('point')).toBe(true);
    expect(qAll(card, '.geometry-tiles image').length).toBeGreaterThan(0);
    expect(q(card, '.geometry-marker-casing')).not.toBeNull();
    expect(q(card, '.geometry-marker')).not.toBeNull();
    expect(inside(anchorOf(q(card, '.geometry-marker')!), viewBoxOf(svg!))).toBe(true);
    expect(q(card, '.geometry-attrib')?.textContent).toBe('© OpenStreetMap');
    cleanup();
  });

  it('renders no mini-map when showGeometry is unset', async () => {
    const { card, cleanup } = await mountCard(
      rfsConfig({ showGeometry: undefined }),
      makeHass({ 'geo_location.fire': rfsIncident() }),
    );
    expect(q(card, '.alert-geometry')).toBeNull();
    cleanup();
  });

  it('frames a cap_alerts point-only alert (degenerate bbox) like a point incident', async () => {
    // cap_alerts publishes a marker-only incident as bbox [lon, lat, lon, lat];
    // the adapter derives `point` from it. Framing that box as the alert's own
    // extent lands at the deepest zoom over a few pixels of tile.
    const { card, cleanup } = await mountCard(
      capConfig(MAP),
      makeHass({ 'sensor.cap_alert_abc': capPointAlert() }),
    );
    const svg = q(card, 'svg.alert-geometry.map');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('point')).toBe(true);
    const tiles = [...qAll(card, '.geometry-tiles image')];
    expect(tiles.length).toBeGreaterThan(0);
    // The synthesized 10 km frame, not the ~10 m padded point: z11, not z16.
    const zooms = new Set(tiles.map(t => tileZoom(t.getAttribute('href') || '')));
    expect(zooms).toEqual(new Set([11]));
    // Alone in its frame, the incident sits at the centre: exact in x, and
    // within a few pixels in y (the Mercator frame's padding is not linear).
    const { w, h } = viewBoxOf(svg!);
    const a = anchorOf(q(card, '.geometry-marker')!);
    expect(a.x).toBeCloseTo(w / 2, 3);
    expect(Math.abs(a.y - h / 2)).toBeLessThan(h * 0.05);
    cleanup();
  });

  it('keeps a real cap_alerts bbox as the frame even when a point is present', async () => {
    const alert = capPointAlert();
    alert.attributes.bbox = [146.1, -34.65, 146.2, -34.55]; // ~9 km × 11 km
    const { card, cleanup } = await mountCard(
      capConfig(MAP),
      makeHass({ 'sensor.cap_alert_abc': alert }),
    );
    const tiles = [...qAll(card, '.geometry-tiles image')];
    const zooms = new Set(tiles.map(t => tileZoom(t.getAttribute('href') || '')));
    // Its own extent frames it (z12 for ~10 km), not the 10 km point frame.
    expect(zooms).toEqual(new Set([12]));
    cleanup();
  });

  it('renders nothing for an alert with neither bbox nor point (NWS)', async () => {
    const { card, cleanup } = await mountCard(
      { ...capConfig(), entity: 'sensor.nws_alerts' },
      makeHass({ 'sensor.nws_alerts': nwsAlert() }),
    );
    expect(q(card, '.meta-grid')).not.toBeNull(); // details are open …
    expect(q(card, '.alert-geometry')).toBeNull();  // … but there is no map
    cleanup();
  });
});

describe('my-location marker', () => {
  it('is never drawn unless showMyLocation is true, even when a reference point resolves', async () => {
    const { card, cleanup } = await mountCard(rfsConfig(), makeHass({ 'geo_location.fire': rfsIncident() }));
    expect(q(card, '.geometry-marker')).not.toBeNull();
    expect(q(card, '.geometry-reference-ring')).toBeNull();
    expect(q(card, '.geometry-reference-core')).toBeNull();
    cleanup();
  });

  it('draws the reference ring under the incident, and the synthesized frame holds both', async () => {
    const { card, cleanup } = await mountCard(
      rfsConfig({ showMyLocation: true }),
      makeHass({ 'geo_location.fire': rfsIncident() }),
    );
    const svg = q(card, 'svg.alert-geometry')!;
    const ring = q(card, '.geometry-reference-ring');
    const core = q(card, '.geometry-reference-core');
    const marker = q(card, '.geometry-marker');
    expect(ring).not.toBeNull();
    expect(core).not.toBeNull();
    expect(marker).not.toBeNull();
    const box = viewBoxOf(svg);
    expect(inside(anchorOf(ring!), box)).toBe(true);
    expect(inside(anchorOf(marker!), box)).toBe(true);
    // Home is east of the incident ⇒ larger x; same latitude ⇒ same y.
    expect(anchorOf(ring!).x).toBeGreaterThan(anchorOf(marker!).x);
    expect(anchorOf(ring!).y).toBeCloseTo(anchorOf(marker!).y, 3);
    // Reference is painted first (under), the incident last (on top).
    const paths = [...qAll(card, 'svg.alert-geometry path')].map(p => p.className.baseVal);
    expect(paths.indexOf('geometry-reference-ring')).toBeLessThan(paths.indexOf('geometry-marker'));
    expect(svg.getAttribute('aria-label')).toBe('Somewhere, with your location marked');
    cleanup();
  });

  it('drops the reference point from a synthesized frame when it is too far away', async () => {
    const { card, cleanup } = await mountCard(
      rfsConfig({ showMyLocation: true }),
      makeHass({ 'geo_location.fire': rfsIncident() }, MELBOURNE),
    );
    expect(REFERENCE_FRAME_MAX_KM).toBeLessThan(700);
    expect(q(card, '.geometry-marker')).not.toBeNull();
    expect(q(card, '.geometry-reference-ring')).toBeNull();
    // The frame stayed the single-point frame: the incident is centred.
    const svg = q(card, 'svg.alert-geometry')!;
    const { w, h } = viewBoxOf(svg);
    expect(anchorOf(q(card, '.geometry-marker')!).x).toBeCloseTo(w / 2, 3);
    expect(anchorOf(q(card, '.geometry-marker')!).y).toBeCloseTo(h / 2, 3);
    expect(svg.getAttribute('aria-label')).toBe('Somewhere');
    cleanup();
  });

  it('takes the reference point from myLocationEntity when set', async () => {
    const { card, cleanup } = await mountCard(
      rfsConfig({ showMyLocation: true, myLocationEntity: 'zone.work' }),
      makeHass({
        'geo_location.fire': rfsIncident(),
        // ~5 km north of the incident; home (Sydney) would land east instead.
        'zone.work': { state: '0', attributes: { latitude: INCIDENT.latitude + 0.045, longitude: INCIDENT.longitude } },
      }),
    );
    const ring = anchorOf(q(card, '.geometry-reference-ring')!);
    const marker = anchorOf(q(card, '.geometry-marker')!);
    expect(ring.x).toBeCloseTo(marker.x, 3);
    expect(ring.y).toBeLessThan(marker.y); // north ⇒ smaller y
    cleanup();
  });

  it('draws nothing for my location when no reference point resolves', async () => {
    const { card, cleanup } = await mountCard(
      rfsConfig({ showMyLocation: true }),
      makeHass({ 'geo_location.fire': rfsIncident() }, null),
    );
    expect(q(card, '.geometry-marker')).not.toBeNull();
    expect(q(card, '.geometry-reference-ring')).toBeNull();
    cleanup();
  });

  it('also renders in map style, cased incident on top', async () => {
    const { card, cleanup } = await mountCard(
      rfsConfig({ ...MAP, showMyLocation: true }),
      makeHass({ 'geo_location.fire': rfsIncident() }),
    );
    const paths = [...qAll(card, 'svg.alert-geometry.map path')].map(p => p.className.baseVal);
    expect(paths).toEqual([
      'geometry-reference-ring',
      'geometry-reference-core',
      'geometry-marker-casing',
      'geometry-marker',
    ]);
    cleanup();
  });
});

describe('polygon providers (cap_alerts) are unchanged', () => {
  it('renders the bbox frame with no incident marker and no point class', async () => {
    const { card, cleanup } = await mountCard(capConfig(), makeHass({ 'sensor.cap_alert_abc': capAlert() }));
    const svg = q(card, 'svg.alert-geometry');
    expect(svg).not.toBeNull();
    expect(svg!.classList.contains('point')).toBe(false);
    expect(q(card, '.geometry-frame')).not.toBeNull();
    expect(q(card, '.geometry-marker')).toBeNull();
    expect(q(card, '.geometry-reference-ring')).toBeNull();
    expect(svg!.getAttribute('aria-label')).toBe('Boulder; Larimer');
    cleanup();
  });

  it('layers the my-location ring over a real bbox without widening the frame (clips when outside)', async () => {
    const { card, cleanup } = await mountCard(
      capConfig({ showMyLocation: true }),
      makeHass({ 'sensor.cap_alert_abc': capAlert() }),
    );
    const svg = q(card, 'svg.alert-geometry')!;
    // The frame is the alert's own bbox: 0.2° × 0.2° cos-lat corrected.
    const { w, h } = viewBoxOf(svg);
    expect(h).toBeCloseTo(0.2, 5);
    expect(w).toBeCloseTo(0.2 * Math.cos((40 * Math.PI) / 180), 5);
    // Sydney is nowhere near Boulder: the ring exists but projects off-frame.
    const ring = q(card, '.geometry-reference-ring');
    expect(ring).not.toBeNull();
    expect(inside(anchorOf(ring!), { w, h })).toBe(false);
    expect(q(card, '.geometry-marker')).toBeNull();
    cleanup();
  });
});
